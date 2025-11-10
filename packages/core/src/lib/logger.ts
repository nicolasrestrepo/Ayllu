import { createMemoryStorage, MemoryStorage } from './memory-storage';
import { defaultPolicies, runPolicies } from './policies';
import {
  ensureRecord,
  mergeContexts,
  randomId,
  sleep,
} from './utils';
import type {
  Enricher,
  LogContext,
  LogInput,
  LogLevel,
  LogRecord,
  Logger,
  LoggerEvent,
  LoggerEventListener,
  LoggerEventType,
  LoggerOptions,
  PolicyResult,
  Sampler,
  StorageLike,
} from './types';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type AnyListener = LoggerEventListener<LoggerEventType>;

type EventSubscriber = {
  listener: AnyListener;
  filter?: LoggerEventType;
};

const createEventHub = () => {
  const subscribers = new Set<EventSubscriber>();

  return {
    emit(event: LoggerEvent) {
      subscribers.forEach(({ listener, filter }) => {
        if (!filter || filter === event.type) {
          listener(event);
        }
      });
    },
    subscribe<T extends LoggerEventType>(
      listener: LoggerEventListener<T>,
      type?: T
    ) {
      const wrapped: AnyListener = (event) =>
        listener(event as LoggerEvent<T>);
      const entry: EventSubscriber = { listener: wrapped, filter: type };
      subscribers.add(entry);
      return () => subscribers.delete(entry);
    },
  };
};

const sanitizeError = (error: unknown): Record<string, unknown> | undefined => {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    const payload: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };
    if (error.stack) {
      payload['stack'] = error.stack.split('\n').slice(0, 5).join('\n');
    }
    return payload;
  }

  if (typeof error === 'object') {
    return ensureRecord(error, { message: '[unknown error]' });
  }

  return { message: String(error) };
};

const shouldLog = (current: LogLevel, target: LogLevel) =>
  LEVEL_PRIORITY[current] >= LEVEL_PRIORITY[target];

const attemptHealthCheck = async (storage: StorageLike, batch: LogRecord[]) => {
  // Ensure inflight entries are not stranded if a transport never succeeds.
  if ('requeue' in storage && typeof storage.requeue === 'function') {
    await (storage as MemoryStorage).requeue(batch);
  } else {
    await storage.drop(batch.map((item) => item.id));
    await storage.push(batch);
  }
};

type FlushContext = {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

const exponentialBackoff = (
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number => {
  const expDelay = Math.min(
    baseDelayMs * 2 ** attempt,
    maxDelayMs
  );
  const jitter = expDelay * 0.5 * Math.random();
  return expDelay + jitter;
};

const createSampler = (sampler?: Sampler): Sampler => sampler ?? (() => true);

const applyEnrichers = async (
  log: LogRecord,
  enrichers: Enricher[]
): Promise<LogRecord> => {
  let enriched = log.enriched;
  for (const enricher of enrichers) {
    try {
      const result = await enricher(log);
      if (result) {
        enriched = mergeContexts(enriched, ensureRecord(result));
      }
    } catch {
      // Ignore enricher errors to avoid breaking the logging flow.
    }
  }
  return { ...log, enriched };
};

const enforceSchema = (schema: LoggerOptions['schema'], input: LogInput) => {
  if (!schema) {
    return input;
  }
  return schema.parse(input);
};

export const createLogger = (options: LoggerOptions): Logger => {
  const level = options.level ?? 'info';
  const storage: StorageLike =
    options.storage ?? createMemoryStorage();
  const enrichers = options.enrichers ?? [];
  const policies = options.policies ?? defaultPolicies;
  const sampler = createSampler(options.sampler);
  const clock = options.clock ?? (() => Date.now());
  const idGenerator = options.idGenerator ?? randomId;
  const batchConfig = {
    size: options.batch?.size ?? 25,
    flushIntervalMs: options.batch?.flushIntervalMs ?? 3_000,
    maxAttempts: options.batch?.maxAttempts ?? 4,
    baseDelayMs: options.batch?.baseDelayMs ?? 250,
    maxDelayMs: options.batch?.maxDelayMs ?? 10_000,
  };
  const autoFlush = options.autoFlush ?? true;
  const eventHub = createEventHub();

  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let flushing = false;
  let pendingFlush: Promise<void> | undefined;
  let pendingCount = 0;

  const notify = (event: LoggerEvent) => eventHub.emit(event);

  const scheduleFlush = () => {
    if (!autoFlush || flushTimer) {
      return;
    }
    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, batchConfig.flushIntervalMs);
  };

  const processBatch = async (
    batch: LogRecord[]
  ): Promise<void> => {
    if (!batch.length) {
      return;
    }

    const context: FlushContext = {
      attempts: 0,
      baseDelayMs: batchConfig.baseDelayMs,
      maxDelayMs: batchConfig.maxDelayMs,
    };

    while (context.attempts < batchConfig.maxAttempts) {
      try {
        await options.transport.send(batch);
        await storage.drop(batch.map((item) => item.id));
        notify({ type: 'flushed', batch });
        pendingCount = Math.max(pendingCount - batch.length, 0);
        return;
      } catch (error) {
        context.attempts += 1;

        const delay = exponentialBackoff(
          context.attempts,
          context.baseDelayMs,
          context.maxDelayMs
        );

        notify({
          type: 'flush-error',
          error,
          batch,
          attempt: context.attempts,
        });

        if (context.attempts >= batchConfig.maxAttempts) {
          // Give controllers a chance to react (e.g. metrics).
          options.onError?.(error, batch[0]);
          notify({ type: 'transport-unhealthy', error });
          await storage.drop(batch.map((item) => item.id));
          await attemptHealthCheck(storage, batch);
          return;
        }

        notify({
          type: 'retrying',
          error,
          batch,
          attempt: context.attempts,
          nextAttemptDelayMs: delay,
        });

        if (typeof options.transport.healthy === 'function') {
          try {
            const ok = await options.transport.healthy();
            if (!ok) {
              await sleep(delay);
              continue;
            }
          } catch {
            await sleep(delay);
            continue;
          }
        }

        await sleep(delay);
      }
    }
  };

  const flush = async (): Promise<void> => {
    if (flushing) {
      return pendingFlush ?? Promise.resolve();
    }

    flushing = true;
    pendingFlush = (async () => {
      try {
        while (true) {
          const batch = await storage.take(batchConfig.size);
          if (!batch.length) {
            break;
          }
          await processBatch(batch);
        }
      } finally {
        flushing = false;
        pendingFlush = undefined;
      }
    })();

    return pendingFlush;
  };

  const emitAndQueue = async (
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown
  ): Promise<void> => {
    try {
      const baseInput: LogInput = {
        message,
        context: ensureRecord(context),
        error,
      };

      const validated = enforceSchema(options.schema, baseInput);

      const record: LogRecord = {
        id: idGenerator(),
        level,
        message: validated.message,
        timestamp: clock(),
        context: ensureRecord(validated.context),
        enriched: {},
        tags: validated.tags ?? [],
        error: validated.error,
      };

      if (error) {
        const serialized = sanitizeError(error);
        if (serialized) {
          record.context = mergeContexts(
            ensureRecord(record.context),
            {
              error: serialized,
            }
          );
        }
      }

      const enriched = await applyEnrichers(record, enrichers);

      const policyResult: PolicyResult = await runPolicies(enriched, policies);
      if (policyResult.kind === 'drop') {
        notify({ type: 'dropped', log: enriched, reason: policyResult.reason });
        return;
      }

      const candidate = policyResult.log ?? enriched;
      const allowed = await sampler(candidate);
      if (!allowed) {
        notify({ type: 'dropped', log: candidate, reason: 'sampled-out' });
        return;
      }

      await storage.push([candidate]);
      pendingCount += 1;
      notify({ type: 'queued', log: candidate });

      if (pendingCount >= batchConfig.size) {
        void flush();
      } else {
        scheduleFlush();
      }
    } catch (runtimeError) {
      options.onError?.(runtimeError);
      notify({
        type: 'dropped',
        log: {
          id: randomId(),
          level,
          message,
          timestamp: clock(),
          context: ensureRecord(context),
          enriched: {},
          tags: [],
        },
        reason: 'logger-failure',
      });
    }
  };

  const logWithLevel = (targetLevel: LogLevel) => (
    message: string,
    context?: LogContext,
    error?: unknown
  ) => {
    if (!shouldLog(targetLevel, level)) {
      return;
    }
    void emitAndQueue(targetLevel, message, context, error);
  };

  if (autoFlush && options.browserHooks !== false && typeof window !== 'undefined') {
    const flushHandler = () => {
      void flush();
    };
    window.addEventListener('beforeunload', flushHandler, { capture: true });
    window.addEventListener('pagehide', flushHandler, { capture: true });
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushHandler();
      }
    });
  }

  return {
    level,
    debug: logWithLevel('debug'),
    info: logWithLevel('info'),
    warn: logWithLevel('warn'),
    error: (message, context, error) =>
      logWithLevel('error')(message, context, error),
    flush,
    async shutdown() {
      if (flushTimer) {
        clearTimeout(flushTimer);
      }
      await flush();
    },
    events: {
      subscribe<T extends LoggerEventType>(
        listener: LoggerEventListener<T>,
        type?: T
      ) {
        return eventHub.subscribe(listener, type);
      },
    },
  };
};

export type { LoggerOptions, LoggerEvent, LoggerEventType } from './types';

