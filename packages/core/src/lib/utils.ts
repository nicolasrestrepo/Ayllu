export const cloneDeep = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
};

const sanitizePlainRecord = (
  value: Record<string, unknown>
): Record<string, unknown> => {
  const blockedKeys = new Set(['__proto__', 'prototype', 'constructor']);
  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (blockedKeys.has(key)) {
      continue;
    }
    output[key] = entry;
  }

  return output;
};

export const getByPath = (source: unknown, path: string): unknown => {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }

  return path.split('.').reduce<unknown>((acc, key) => {
    if (typeof acc !== 'object' || acc === null) {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, source);
};

export const setByPath = (
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void => {
  const segments = path.split('.');
  let cursor: Record<string, unknown> = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i]!;
    if (
      typeof cursor[key] !== 'object' ||
      cursor[key] === null ||
      Array.isArray(cursor[key])
    ) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[segments[segments.length - 1]!] = value;
};

export const hasPath = (target: unknown, path: string): boolean =>
  getByPath(target, path) !== undefined;

export const removeByPath = (
  target: Record<string, unknown>,
  path: string
): void => {
  const segments = path.split('.');
  let cursor: Record<string, unknown> | undefined = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i]!;
    const next = cursor?.[key];
    if (typeof next !== 'object' || next === null) {
      return;
    }
    cursor = next as Record<string, unknown>;
  }

  const leaf = segments[segments.length - 1];
  if (leaf && cursor) {
    delete cursor[leaf];
  }
};

export const ensureRecord = (
  value: unknown,
  fallback: Record<string, unknown> = {}
): Record<string, unknown> => {
  if (!isPlainObject(value)) {
    return fallback;
  }

  return sanitizePlainRecord(value);
};

export const mergeContexts = (
  base: Record<string, unknown>,
  patch?: Record<string, unknown>
): Record<string, unknown> => {
  if (!patch) {
    return base;
  }

  const output = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof output[key] === 'object' &&
      output[key] !== null &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeContexts(
        output[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      output[key] = value;
    }
  }
  return output;
};

export const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `log_${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  timeoutError: Error
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(timeoutError), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export const utf8Length = (input: string): number => {
  if (typeof TextEncoder === 'function') {
    return new TextEncoder().encode(input).byteLength;
  }

  if (typeof Buffer === 'function') {
    return Buffer.byteLength(input, 'utf8');
  }

  return input.length;
};

