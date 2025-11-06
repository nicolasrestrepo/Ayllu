# @ayllu/core

`@ayllu/core` is the heart of the Ayllu SDK. It owns the domain types, logger factory, batching pipeline, and the policy engine that keeps every transport and storage vendor-agnostic.

## Features

- Strongly typed log model (`Log`, `LogLevel`, `LogContext`).
- `createLogger()` factory uses **Factory**, **Strategy**, and **Chain of Responsibility** patterns to compose transports, storages, enrichers, and privacy policies.
- Batching with exponential backoff + jitter, maximum in-flight control, and backpressure.
- Observer bus for devtools hooks (`onQueue`, `onFlush`, `onFailure`).
- Memory-backed storage fallback when offline persistence is unavailable.
- Lifecycle hooks (`beforeFlush`, `afterFlush`, `onError`) and browser signals (`pagehide`, `visibilitychange`).

## Quick Start

```ts
import { createLogger, LogLevel } from '@ayllu/core';
import { createHttpTransport } from '@ayllu/transport-http';
import { createIndexedDbStorage } from '@ayllu/storage-indexeddb';

const logger = createLogger({
  level: LogLevel.INFO,
  transport: createHttpTransport({ url: '/api/logs' }),
  storage: createIndexedDbStorage({ dbName: 'ayllu-logs' }),
  enrichers: [
    () => ({ url: location.href, userAgent: navigator.userAgent }),
  ],
  policies: [
    { action: 'redact', path: 'ctx.user.email' },
    { action: 'truncate', path: 'message', maxLength: 512 },
  ],
});

logger.info('client:boot', { release: '1.2.3' });
```

### Core Concepts

| Concept | Description |
|---------|-------------|
| `Transport` | Adapter that delivers a batch of logs. Includes optional `healthy()` probe for readiness checks. |
| `StorageLike` | Strategy interface (`push`, `take`, `drop`) for persistent or in-memory queues. |
| `Policy` | Privacy or governance rule executed as part of a chain. Supports `redact`, `drop`, and `truncate`. |
| `Enricher` | Pure function that adds context (`device`, `session`, `network`). Runs synchronously before storage. |
| `Sampler` | Optional rate-limiting hook executed before enqueueing. |

## Available APIs

- `createLogger(options)` – factory for the fully configured logger pipeline.
- `createMemoryStorage()` – default in-memory queue fallback.
- `defaultPolicies` / `defaultEnrichers` – opinionated packs for quick bootstrap.
- Type exports to help build custom adapters and storages.

## Nx Tasks

| Command | Description |
|---------|-------------|
| `pnpm nx build @ayllu/core` | Emit ESM/CJS bundles using TypeScript (`@nx/js:tsc`). |
| `pnpm nx test @ayllu/core` | Run unit tests via Vitest (`vite.config.ts`). |
| `pnpm nx lint @ayllu/core` | Lint the package with the shared ESLint flat config. |

## Extending the Core

- Implement custom policies by returning `{ action: 'custom', handler }` and registering the handler with the policy chain.
- Provide your own sampler strategy for rate control (e.g., dynamic sampling by level or user).
- Hook into the observer bus to build developer tooling (`logger.events.subscribe(...)`).

For an end-to-end example, see the Next.js demo in `examples/next-app`.
