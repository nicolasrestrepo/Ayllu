# @ayllu/transport-http

`@ayllu/transport-http` implements the HTTP adapter for Ayllu. It translates batched log payloads into `fetch` requests, handles retries with exponential backoff, and respects privacy guarantees enforced upstream by the core pipeline.

## Features

- Configurable endpoint (`url`), headers, credential mode, and request shaping.
- Automatic JSON serialization with size guardrails.
- Exponential backoff with full jitter and configurable retry budget.
- Health probe via `healthy()` to detect vendor downtime.
- Hooks for transforming the request (`beforeSend`) or response (`afterSend`).

## Usage

```ts
import { createLogger } from '@ayllu/core';
import { createHttpTransport } from '@ayllu/transport-http';

const transport = createHttpTransport({
  url: '/api/logs',
  headers: () => ({
    'Content-Type': 'application/json',
    'x-release': import.meta.env.PUBLIC_RELEASE,
  }),
  retry: {
    attempts: 5,
    baseDelayMs: 500,
    maxDelayMs: 15_000,
  },
});

const logger = createLogger({ transport });
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | required | Proxy or vendor endpoint that receives batched logs. |
| `headers` | `Record<string,string> \| () => Record<string,string>` | `{}` | Static or dynamic headers (e.g., auth tokens from cookies). |
| `credentials` | `'omit' \'same-origin\' \'include'` | `'same-origin'` | Passed straight through to `fetch`. |
| `retry.attempts` | `number` | `4` | Maximum number of retries when the request fails. |
| `retry.baseDelayMs` | `number` | `250` | Initial delay before backoff kicks in. |
| `retry.maxDelayMs` | `number` | `10_000` | Upper bound for backoff (full jitter). |
| `beforeSend(batch)` | `(batch) => RequestInit` | — | Override or extend the generated request body. |
| `afterSend(result)` | `(response) => void` | — | Inspect vendor response, emit metrics, etc. |

## Nx Tasks

| Command | Description |
|---------|-------------|
| `pnpm nx build @ayllu/transport-http` | Build ESM output for publishing/testing. |
| `pnpm nx test @ayllu/transport-http` | Run unit tests with Vitest. |
| `pnpm nx lint @ayllu/transport-http` | Lint the adapter implementation. |

## Extending

- Combine with the example proxy route in `examples/next-app` to keep vendor credentials server-side.
- Use the same adapter interface to create new transports (`@ayllu/transport-otlp`, `@ayllu/transport-loki`).
- Implement custom `beforeSend` logic to sign requests or chunk the batch payload.
