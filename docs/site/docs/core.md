---
id: ayllu-core
title: "@ayllu/core"
sidebar_position: 2
---

`@ayllu/core` is the heart of the SDK. It exposes the domain model, logging API, batching engine, sampling hooks, privacy policies, and observer bus.

## Quick start

```ts
import {
  createLogger,
  createMemoryStorage,
  defaultPolicies,
  type Logger,
} from '@ayllu/core';
import { createHttpTransport } from '@ayllu/transport-http';

const transport = createHttpTransport({
  url: '/api/logs',
  headers: () => ({ 'x-ayllu-signature': 'demo-signature' }),
});

export const logger: Logger = createLogger({
  level: 'info',
  transport,
  storage: createMemoryStorage(),
  policies: [
    ...defaultPolicies,
    { type: 'redact', path: 'context.user.email' },
  ],
  schema: logSchema,
});
```

The logger exposes level-specific methods (`debug`, `info`, `warn`, `error`), a `flush()` helper, `shutdown()` for graceful teardown, and an `events` observable for devtools.

## Options overview

| Option | Description |
|--------|-------------|
| `transport` | Required adapter that delivers batches (`send` + optional `healthy`). |
| `storage` | Queue implementation. Memory is used when `storage` is omitted. |
| `policies` | Chain of privacy/governance rules (`redact`, `truncate`, `drop`, or custom). |
| `enrichers` | Synchronous functions that augment context before persistence. |
| `sampler` | Predicate that decides whether a log should be enqueued. |
| `schema` | Optional [Zod](https://zod.dev) schema enforced before enrichment/policies. |
| `batch` | `{ size, flushIntervalMs, maxAttempts, baseDelayMs, maxDelayMs }` controls batching & retries. |
| `browserHooks` | Toggle automatic flush on `pagehide`/`beforeunload` (enabled by default). |
| `payload` | `{ maxRecordSizeBytes }` drops logs whose UTF-8 serialisation exceeds the limit (defaults to 64&nbsp;KiB). |

## Payload guard

- Every context or enriched payload is coerced into a prototype-free object, preventing prototype pollution.
- Set `payload.maxRecordSizeBytes` to enforce a hard cap on individual records. Logs above the limit are dropped (`reason: "payload-too-large"`), and `onError` is notified.
- Use `Infinity` to disable the guard or a smaller value when bandwidth/storage are constrained.

## Privacy policies

Policies implement a **Chain of Responsibility**: each rule receives the log, can mutate the payload, or mark it for dropping. Built-in utilities include:

- `type: 'redact'` – replace a path with `"[REDACTED]"` (or a custom string).
- `type: 'truncate'` – shorten long strings to a fixed length.
- `type: 'drop'` – remove a field (if the path is in `context`/`enriched`) or discard the log entirely.
- `type: 'custom'` – run arbitrary logic that returns `{ kind: 'continue', log }` or `{ kind: 'drop', reason }`.

Rules are evaluated after enrichers and before sampling so that sensitive data never touches storage or the network.

## Observer bus

Subscribe to runtime events to power dashboards or devtools:

```ts
const unsubscribe = logger.events.subscribe('queued', ({ log }) => {
  console.log('Queued log', log.id, log.level);
});

// Later
unsubscribe();
```

Available event types: `queued`, `dropped`, `flushed`, `flush-error`, `retrying`, and `transport-unhealthy`.
