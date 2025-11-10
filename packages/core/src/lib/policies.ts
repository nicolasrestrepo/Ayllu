import {
  cloneDeep,
  getByPath,
  hasPath,
  removeByPath,
  setByPath,
} from './utils';
import type {
  LogRecord,
  Policy,
  PolicyResult,
  PolicyPredicate,
  RedactPolicy,
  TruncatePolicy,
  DropPolicy,
  CustomPolicy,
} from './types';

const defaultReplacement = '[REDACTED]';

const evaluatePredicate = (
  predicate: PolicyPredicate | undefined,
  value: unknown,
  log: LogRecord
): boolean => {
  if (!predicate) {
    return true;
  }
  try {
    return predicate(value, log);
  } catch {
    return false;
  }
};

const applyRedact = (log: LogRecord, policy: RedactPolicy): LogRecord => {
  if (!hasPath(log, policy.path)) {
    return log;
  }

  const value = getByPath(log, policy.path);
  if (!evaluatePredicate(policy.predicate, value, log)) {
    return log;
  }

  const next = cloneDeep(log);
  setByPath(
    next as unknown as Record<string, unknown>,
    policy.path,
    policy.replacement ?? defaultReplacement
  );

  return next;
};

const applyTruncate = (log: LogRecord, policy: TruncatePolicy): LogRecord => {
  const value = getByPath(log, policy.path);
  if (typeof value !== 'string') {
    return log;
  }

  if (!evaluatePredicate(policy.predicate, value, log)) {
    return log;
  }

  if (value.length <= policy.maxLength) {
    return log;
  }

  const next = cloneDeep(log);
  const truncated = `${value.slice(0, policy.maxLength)}…`;
  setByPath(
    next as unknown as Record<string, unknown>,
    policy.path,
    truncated
  );

  return next;
};

const applyDrop = (
  log: LogRecord,
  policy: DropPolicy
): PolicyResult => {
  if (!policy.path) {
    return { kind: 'drop', reason: policy.reason };
  }

  if (!hasPath(log, policy.path)) {
    return { kind: 'continue' };
  }

  const value = getByPath(log, policy.path);
  if (!evaluatePredicate(policy.predicate, value, log)) {
    return { kind: 'continue' };
  }

  if (policy.path.startsWith('context.') || policy.path.startsWith('enriched.')) {
    const next = cloneDeep(log);
    removeByPath(
      policy.path.startsWith('context.')
        ? (next.context ??= {})
        : (next.enriched ??= {}),
      policy.path.split('.').slice(1).join('.')
    );
    return { kind: 'continue', log: next };
  }

  return { kind: 'drop', reason: policy.reason };
};

export const runPolicies = async (
  log: LogRecord,
  policies: Policy[] = []
): Promise<PolicyResult> => {
  let current = log;

  for (const policy of policies) {
    if (policy.type === 'redact') {
      current = applyRedact(current, policy);
      continue;
    }

    if (policy.type === 'truncate') {
      current = applyTruncate(current, policy);
      continue;
    }

    if (policy.type === 'drop') {
      const result = applyDrop(current, policy);
      if (result.kind === 'drop') {
        return result;
      }

      if (result.log) {
        current = result.log;
      }
      continue;
    }

    if (policy.type === 'custom') {
      const result = await policy.handler(current);
      if (result.kind === 'drop') {
        return result;
      }
      if (result.log) {
        current = result.log;
      }
      continue;
    }
  }

  return { kind: 'continue', log: current };
};

export const defaultPolicies: Policy[] = [
  {
    name: 'redact-password',
    type: 'redact',
    path: 'context.password',
  },
  {
    name: 'redact-token',
    type: 'redact',
    path: 'context.token',
  },
  {
    name: 'truncate-message',
    type: 'truncate',
    path: 'message',
    maxLength: 2_000,
  },
];

