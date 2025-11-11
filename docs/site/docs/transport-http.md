---
id: transport-http
title: "@ayllu/transport-http"
sidebar_position: 3
---

This adapter converts log batches into `fetch` requests. It is intentionally small so that production deployments can forward logs through proxy endpoints where credentials and rate limits live.

## Basic usage

```ts
import { createHttpTransport } from '@ayllu/transport-http';

const transport = createHttpTransport({
  url: '/api/logs',
  headers: async () => ({
    'content-type': 'application/json',
    'x-ayllu-signature': await getSignature(),
  }),
  timeoutMs: 4_000,
  healthcheck: {
    url: '/api/logs/health',
    timeoutMs: 1_000,
  },
  retryableStatuses: [408, 425, 429, 500, 502, 503, 504],
});
```

Attach the transport to `createLogger({ transport })` and the core pipeline will handle batching, retry with exponential backoff + jitter, and re-queue failed batches.

## Hooks and overrides

| Option | Description |
|--------|-------------|
| `headers` | Static object or async factory for per-request headers (auth tokens, tenant IDs, etc.). |
| `beforeSend` | Mutate the `RequestInit` before `fetch` runs (set cookies, body encodings, or switch HTTP verbs). |
| `afterSend` | Inspect responses, emit metrics, or schedule out-of-band requests. |
| `serialize` | Custom batch serialization (default JSON). |
| `retryableStatuses` | HTTP status codes that should trigger the core retry logic. |
| `healthy` | Automatic health check endpoint to gate retries.

> Remember that tokens or API keys should never be embedded in the frontend bundle. Forward logs to a proxy (`/api/logs`) and inject vendor credentials on the server.
