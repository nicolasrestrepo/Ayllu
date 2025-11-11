# Ayllu SDK Monorepo

<p align="center">
  <img src="./assets/branding/ayllu-logo.png" alt="Ayllu logo" width="220" />
</p>

Ayllu is a frontend-first, vendor-agnostic observability and logging SDK built for resilience, privacy, and portability. Inspired by *Building a Vendor-Agnostic Logger for a Frontend Application*, the project unifies logging, batching, enrichment, storage, and transport so that any web or mobile app can emit structured telemetry—online or offline—and forward it to the observability vendor of choice.

## Why Ayllu?

- **Adapter-first design** – swap transports (Loki, OTLP, Sentry, Datadog, custom proxies) without touching your logging API.
- **Privacy aware** – redact, drop, or truncate sensitive data before it leaves the runtime.
- **Offline ready** – persist logs with pluggable storage strategies (IndexedDB, AsyncStorage, memory fallback).
- **Resilient delivery** – batching, exponential backoff with jitter, and health checks keep data flowing even when vendors fail.
- **Extensible** – hook into enrichers, policies, and observers to build tailored pipelines and devtools.

## Repository Structure

```
assets/
  branding/           # Logos and marketing visuals
packages/
  core/               # Logger factory, domain model, pipelines, policies
  transport-http/     # Fetch-based transport adapter
  storage-indexeddb/  # IndexedDB persistence strategy
  react/              # React bindings (provider + hook)
examples/
  next-app/           # Next.js 15 demo with proxy API route
docs/
  architecture.md     # System overview and data flow
  policies.md         # Privacy, sampling and governance guidance
```

## Packages at a Glance

| Package | NPM Name | Purpose |
|---------|----------|---------|
| `packages/core` | `@ayllu/core` | Heart of the SDK: domain types, logger factory, policies, batching, retry, in-memory queue, and observer bus. |
| `packages/transport-http` | `@ayllu/transport-http` | Adapter sending batched logs via Fetch to proxy/vendor endpoints with resiliency controls. |
| `packages/storage-indexeddb` | `@ayllu/storage-indexeddb` | Offline-first storage strategy using IndexedDB with pluggable serialization. |
| `packages/react` | `@ayllu/react` | React context, provider, and `useLogger()` hook for ergonomic integration. |
| `examples/next-app` | — | Reference Next.js 15 App Router implementation that wires the SDK, persists offline data, and forwards logs through a proxy API route. |

Each package README documents configuration, exported APIs, and extension points in depth. For additional reference material, see the guides in [`docs/`](./docs).

## Documentation

- Interactive docs live under `docs/site` (Docusaurus).
  - `pnpm --filter docs-site start` – develop locally.
  - `pnpm --filter docs-site build` – generate static assets.
  - `pnpm --filter docs-site serve` – preview the production build.

## Design Principles & Patterns

- **Clean Architecture & SOLID** – core abstractions (`Transport`, `StorageLike`, `Policy`, `Enricher`) isolate infrastructure from domain logic.
- **Adapter Pattern** – transports implement a simple `send(batch)` contract; vendor specifics live outside the core.
- **Strategy Pattern** – storages swap in/out (`memory`, `IndexedDB`, future `AsyncStorage`, etc.).
- **Factory Pattern** – `createLogger(options)` composes transports, storage, enrichers, policies, and observers at runtime.
- **Chain of Responsibility** – policy engine processes mutations (redact, drop, truncate) in sequence.
- **Observer / Pub-Sub** – listeners react to lifecycle events (queued, flushed, failed) for devtools and analytics.
- **Proxy Pattern** – example Next.js API route forwards logs to vendors without exposing secrets on the client.

## Security & Privacy Guardrails

- **Plain-object sanitisation** – payloads passed as `context`, `enriched` data, or policies are coerced into prototype-free objects to avoid prototype pollution.
- **Payload guard** – logs exceeding the configured UTF‑8 size limit (64&nbsp;KiB by default) are dropped before reaching storage or transports.
- **Schema-first validation** – provide a Zod schema to `createLogger` to reject malformed or unexpected payloads early.
- **Policy layering** – redact, truncate, or drop sensitive content before it is ever persisted.
- **Transport signatures & proxying** – example apps validate HMAC-like signatures before forwarding batches to vendors.

```ts
import { createLogger, defaultPolicies } from '@ayllu/core';
import { createHttpTransport } from '@ayllu/transport-http';

const logger = createLogger({
  level: 'info',
  transport: createHttpTransport({ url: '/api/logs' }),
  policies: defaultPolicies,
  schema: logSchema,
  payload: {
    // Drop any record that serialises above 48 KiB.
    maxRecordSizeBytes: 48_000,
  },
});
```

> Set `maxRecordSizeBytes` to `Infinity` to disable the guard, or tighten the limit for highly constrained environments.

## Getting Started

```sh
pnpm install
pnpm nx graph                   # visualize dependency graph
pnpm nx run @ayllu/core:build   # build the core package
pnpm nx serve examples-next-app # start the Next.js demo (see example README)
```

### Common Workspace Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build every package and app (`nx run-many -t build`). |
| `pnpm test` | Run all unit tests with Vitest. |
| `pnpm lint` | Lint all projects with ESLint flat config. |
| `pnpm affected:build` | Build only projects affected by local changes. |
| `pnpm nx graph` | Inspect dependency graph interactively. |

> **Tip:** Use `pnpm nx <target> <project>` for focused commands, e.g. `pnpm nx test @ayllu/storage-indexeddb`.

## Example Flow

1. `@ayllu/core` collects logs via `logger.debug/info/warn/error`.
2. Enrichers append runtime context (user, URL, network status).
3. Policies redact or drop sensitive payload pieces.
4. Storage queues logs (IndexedDB or memory).
5. Batcher flushes to the selected transport with retry + backoff.
6. Transport forwards data to a proxy endpoint (`/api/logs` in the Next.js example). The proxy can enforce authentication, rate limiting, or vendor fan-out.

## Contributing & Roadmap

- Add transports (`@ayllu/transport-otlp`, `@ayllu/transport-loki`) using the adapter contract.
- Expand storage strategies (AsyncStorage for React Native, LocalForage, ServiceWorker).
- Integrate OpenTelemetry semantics and exporters.
- Ship devtools overlay via the observer bus.

Contributions are welcome! Please open an issue to discuss large changes or design proposals.

## License

MIT © Ayllu Contributors
