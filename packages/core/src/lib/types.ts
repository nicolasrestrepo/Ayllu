import type { z } from 'zod';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogInput {
  message: string;
  context?: LogContext;
  tags?: string[];
  error?: unknown;
}

export interface LogRecord extends LogInput {
  id: string;
  level: LogLevel;
  timestamp: number;
  enriched: LogContext;
  attempt?: number;
  tags: string[];
}

export interface Transport {
  send(batch: LogRecord[]): Promise<void>;
  healthy?(): Promise<boolean>;
}

export interface StorageLike {
  push(items: LogRecord[]): Promise<void>;
  take(max: number): Promise<LogRecord[]>;
  drop(ids: string[]): Promise<void>;
}

export type Enricher = (
  draft: Readonly<LogRecord>
) => Promise<LogContext | void> | LogContext | void;

export type Sampler = (
  log: Readonly<LogRecord>
) => Promise<boolean> | boolean;

export type PolicyPredicate = (
  value: unknown,
  log: Readonly<LogRecord>
) => boolean;

export interface BasePolicy {
  name?: string;
}

export interface RedactPolicy extends BasePolicy {
  type: 'redact';
  path: string;
  replacement?: string;
  predicate?: PolicyPredicate;
}

export interface TruncatePolicy extends BasePolicy {
  type: 'truncate';
  path: string;
  maxLength: number;
  predicate?: PolicyPredicate;
}

export interface DropPolicy extends BasePolicy {
  type: 'drop';
  path?: string;
  predicate?: PolicyPredicate;
  reason?: string;
}

export interface CustomPolicy extends BasePolicy {
  type: 'custom';
  handler: (
    log: Readonly<LogRecord>
  ) => Promise<PolicyResult> | PolicyResult;
}

export type Policy = RedactPolicy | TruncatePolicy | DropPolicy | CustomPolicy;

export type PolicyResult =
  | { kind: 'continue'; log?: LogRecord }
  | { kind: 'drop'; reason?: string };

export interface LoggerEventMap {
  queued: { log: LogRecord };
  dropped: { log: LogRecord; reason?: string };
  flushed: { batch: LogRecord[] };
  'flush-error': { error: unknown; batch: LogRecord[]; attempt: number };
  retrying: {
    error: unknown;
    batch: LogRecord[];
    attempt: number;
    nextAttemptDelayMs: number;
  };
  'transport-unhealthy': { error: unknown };
}

export type LoggerEventType = keyof LoggerEventMap;

export type LoggerEvent<T extends LoggerEventType = LoggerEventType> = {
  [K in LoggerEventType]: { type: K } & LoggerEventMap[K];
}[T];

export type LoggerEventListener<T extends LoggerEventType = LoggerEventType> = (
  event: LoggerEvent<T>
) => void;

export interface PayloadOptions {
  /**
   * Maximum allowed UTF-8 size for a single log record before it is dropped.
   * Defaults to 64 KiB. Use `Infinity` to disable the guard.
   */
  maxRecordSizeBytes?: number;
}

export interface LoggerOptions {
  level?: LogLevel;
  transport: Transport;
  storage?: StorageLike;
  enrichers?: Enricher[];
  policies?: Policy[];
  sampler?: Sampler;
  schema?: z.ZodType<LogInput>;
  batch?: {
    size?: number;
    flushIntervalMs?: number;
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  onError?: (error: unknown, log?: LogRecord) => void;
  autoFlush?: boolean;
  browserHooks?: boolean;
  clock?: () => number;
  idGenerator?: () => string;
  payload?: PayloadOptions;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext, error?: unknown): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
  level: LogLevel;
  events: {
    subscribe<T extends LoggerEventType = LoggerEventType>(
      listener: LoggerEventListener<T>,
      type?: T
    ): () => void;
  };
}

