# Next.js Example (`examples/next-app`)

This demo shows how to wire the Ayllu SDK inside a Next.js 15 App Router application. It demonstrates:

- Rendering the `LoggerProvider` from `@ayllu/react` at the root layout.
- Configuring `@ayllu/core` with the HTTP transport and IndexedDB storage.
- Streaming logs to a proxy API route (`src/app/api/logs/route.ts`) so that vendor credentials remain server-side.
- Batching, retry, and offline persistence in action.

## Running the App

```sh
pnpm nx serve examples-next-app
```

The app runs on `http://localhost:4200` by default. Trigger user interactions in the UI and inspect the proxy route logs in your terminal.

## Key Files

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Registers the `LoggerProvider` for the entire app. |
| `src/app/page.tsx` | Emits example log events using `useLogger()`. |
| `src/app/api/logs/route.ts` | Proxy endpoint that validates payloads and forwards them to a vendor (placeholder implementation). |
| `specs/index.spec.tsx` | Example Jest/RTL test exercising the integration. |

## Proxy Route Stub

The proxy route intentionally short-circuits actual vendor delivery. Modify `route.ts` to call your observability backend (Loki, OTLP, Sentry, Datadog, etc.). The route already includes hooks for:

- Validating request signatures.
- Injecting vendor credentials from secure server-side storage.
- Controlling response codes for retries.

## Extending the Demo

- Add Service Worker caching to simulate offline-first web apps.
- Integrate the observer bus with custom devtools (e.g., overlay panel).
- Showcase additional transports by wiring `@ayllu/transport-http` to multiple vendors.

