# Architecture Overview

Ayllu is organised as an Nx monorepo that separates the logging pipeline into composable libraries. The goal is to let frontend applications assemble a resilient, privacy-aware telemetry system while keeping vendor-specific logic outside of the core domain.

## High-Level Flow

1. **Event emission** – Application code calls the logger (`debug`, `info`, `warn`, `error`).
2. **Enrichment** – Enrichers add static or dynamic context (URL, device, network state, user traits).
3. **Governance policies** – A chain of policies redacts, truncates, or drops sensitive fields before persistence.
4. **Sampling** – Optional sampler decides whether the event should be retained, based on level, user, or custom logic.
5. **Queueing** – The selected storage strategy (`IndexedDB`, `memory`, future adapters) persists the log for batched delivery.
6. **Batching & retry** – The scheduler flushes the queue in batches, applying exponential backoff with jitter when a transport fails.
7. **Transport** – Adapters (HTTP today, OTLP/Loki later) forward batches to proxies or vendor APIs.
8. **Observer bus** – All lifecycle events (`queued`, `flushed`, `failed`, `recovered`) are published to observers for devtools or monitoring hooks.

```
┌────────┐     ┌───────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────┐
│ Logger │──►──│ Enrichers │──►──│ Policy Chain │──►──│ Storage Queue │──►──│ Transport(s)│
└────────┘     └───────────┘     └──────────────┘     └──────┬───────┘     └──────┬─────┘
      ▲                         Observer Bus ▲                │                    │
      └──────────────────────────────────────┴────────────────┴────────────────────┘
```

## Workspace Projects

| Project | Description |
|---------|-------------|
| `@ayllu/core` | Domain model, pipeline orchestration, policies, sampling, batching, lifecycle hooks. |
| `@ayllu/transport-http` | Fetch adapter with retry + health checks. |
| `@ayllu/storage-indexeddb` | Offline queue backed by IndexedDB with graceful fallbacks. |
| `@ayllu/react` | Provider + hook to integrate the logger into React/Next.js. |
| `examples/next-app` | Reference implementation demonstrating the full pipeline and a proxy API route. |

## Design Patterns

- **Factory** – `createLogger()` wires all dependencies (transport, storage, policies, enrichers) into a pipeline.
- **Strategy** – Storage and transport components implement interfaces that can be swapped at runtime or per environment.
- **Adapter** – Vendor-specific logic lives in adapters converting Ayllu batches into endpoint requests.
- **Chain of Responsibility** – Policies execute in sequence, mutating or filtering log payloads.
- **Observer** – Devtools and analytics integrate via `logger.events.subscribe`.
- **Proxy** – Production deployment relies on a server-side proxy (`/api/logs`) to avoid exposing vendor credentials.

## Deployment Considerations

- **Offline-first** – Encourage IndexedDB storage for web apps and AsyncStorage (future adapter) for React Native.
- **Multi-transport** – Multiple transports can be connected simultaneously (e.g., HTTP proxy + console observer during QA).
- **Security** – Policies should enforce redaction of PII and secure hash of identifiers before leaving the client.
- **Observability** – Transport adapters should emit metrics (success/failure counts, latency) through the observer bus for dashboards.

For implementation details, consult the source of each package and the [`examples/next-app`](../examples/next-app/README.md) demo.

