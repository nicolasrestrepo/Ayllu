---
id: example-app
title: Next.js demo
sidebar_position: 6
---

The repository ships with `examples/next-app`, a Next.js 15 (App Router) demo that wires every package together.

## Highlights

- **Client provider** – `AppProviders` (in `src/app/providers.tsx`) creates a logger with:
  - Zod schema validation.
  - Privacy policies that redact emails and tokens.
  - IndexedDB storage with AES-GCM encryption when WebCrypto is present.
  - HTTP transport targeting the `/api/logs` proxy and a health check endpoint.
- **Secure proxy** – `src/app/api/logs/route.ts` validates signatures, runs schema validation server-side, and demonstrates where vendor forwarding logic would live.
- **Interactive UI** – `demo-shell.tsx` exposes buttons that emit info/warn/error logs and renders the live event feed via `useLoggerEvent`.

## Running locally

```bash
pnpm nx serve examples-next-app
# or
pnpm nx dev examples-next-app
```

Open `http://localhost:4200` and inspect the Network tab to watch batched log delivery. Try toggling offline mode in DevTools to see IndexedDB persistence and retries in action.

## Production checklist

1. Replace the demo signature handling with a proper HMAC or JWT strategy in `/api/logs`.
2. Forward validated batches to your vendors (Loki, OTLP, Datadog, etc.) from the proxy route.
3. Host the Docusaurus documentation alongside the example for developer onboarding.
