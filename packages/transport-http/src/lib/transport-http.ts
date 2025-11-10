import type { LogRecord, Transport } from '@ayllu/core';

export interface HttpTransportOptions {
  url: string;
  method?: string;
  headers?:
    | Record<string, string>
    | (() => Promise<Record<string, string>> | Record<string, string>);
  credentials?: RequestCredentials;
  keepalive?: boolean;
  timeoutMs?: number;
  serialize?: (batch: LogRecord[]) => BodyInit;
  beforeSend?: (
    batch: LogRecord[],
    init: RequestInit
  ) => Promise<Partial<RequestInit> | void> | Partial<RequestInit> | void;
  afterSend?: (
    response: Response,
    batch: LogRecord[]
  ) => Promise<void> | void;
  healthcheck?: {
    url: string;
    method?: string;
    timeoutMs?: number;
  };
  retryableStatuses?: number[];
}

export class HttpTransportError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: Response
  ) {
    super(message);
    this.name = 'HttpTransportError';
  }
}

const defaultSerialize = (batch: LogRecord[]): BodyInit =>
  JSON.stringify({ logs: batch });

const resolveHeaders = async (
  source: HttpTransportOptions['headers']
): Promise<Record<string, string>> => {
  if (!source) {
    return {};
  }

  if (typeof source === 'function') {
    return source();
  }

  return source;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal: AbortSignal
): Promise<T> => {
  if (!timeoutMs) {
    return promise;
  }

  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (!signal.aborted) {
        reject(new HttpTransportError('Request timed out'));
      }
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
};

const isRetryableStatus = (
  status: number,
  retryable?: number[]
): boolean => {
  if (!retryable?.length) {
    return status >= 500 || status === 429;
  }
  return retryable.includes(status);
};

export const createHttpTransport = (options: HttpTransportOptions): Transport => {
  const method = options.method ?? 'POST';
  const serialize = options.serialize ?? defaultSerialize;
  const retryableStatuses = options.retryableStatuses;

  return {
    async send(batch: LogRecord[]): Promise<void> {
      const controller = new AbortController();
      const baseHeaders = await resolveHeaders(options.headers);
      const init: RequestInit = {
        method,
        headers: {
          'content-type': 'application/json',
          ...baseHeaders,
        },
        body: serialize(batch),
        credentials: options.credentials ?? 'same-origin',
        keepalive: options.keepalive ?? true,
        signal: controller.signal,
      };

      if (options.beforeSend) {
        const patch = await options.beforeSend(batch, init);
        Object.assign(init, patch);
      }

      const fetchPromise = fetch(options.url, init);
      const response = await withTimeout(
        fetchPromise,
        options.timeoutMs ?? 0,
        controller.signal
      );

      if (!response.ok) {
        if (isRetryableStatus(response.status, retryableStatuses)) {
          throw new HttpTransportError(
            `Transport failed with status ${response.status}`,
            response.status,
            response
          );
        }

        // Non-retryable statuses should still throw to respect the contract,
        // but they will not be retried by the core logger when marked as non-retryable.
        const error = new HttpTransportError(
          `Transport rejected payload with status ${response.status}`,
          response.status,
          response
        );
        try {
          Object.defineProperty(error, 'responseBody', {
            value: await response.clone().text(),
            enumerable: false,
            configurable: true,
          });
        } catch {
          // Ignore body parsing errors.
        }
        throw error;
      }

      if (options.afterSend) {
        await options.afterSend(response, batch);
      }
    },
    async healthy(): Promise<boolean> {
      if (!options.healthcheck) {
        return true;
      }

      const controller = new AbortController();
      const healthInit: RequestInit = {
        method: options.healthcheck.method ?? 'HEAD',
        keepalive: false,
        signal: controller.signal,
      };

      try {
        const response = await withTimeout(
          fetch(options.healthcheck.url, healthInit),
          options.healthcheck.timeoutMs ?? 1_000,
          controller.signal
        );
        return response.ok;
      } catch {
        return false;
      }
    },
  };
};
