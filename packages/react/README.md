# @ayllu/react

`@ayllu/react` delivers first-class React bindings for the Ayllu SDK. It wraps `@ayllu/core` loggers in a context provider and surfaces ergonomic hooks for components to emit structured telemetry.

## Features

- `LoggerProvider` bootstraps a configured `@ayllu/core` pipeline at the app root.
- `useLogger()` exposes typed logging methods (`debug`, `info`, `warn`, `error`).
- Respects React rendering semantics (no re-renders when the logger reference is stable).
- Optional devtools observer for in-app debugging overlays.

## Usage

```tsx
'use client';

import { LoggerProvider, useLogger } from '@ayllu/react';
import { createLogger } from '@ayllu/core';
import { createHttpTransport } from '@ayllu/transport-http';
import { createIndexedDbStorage } from '@ayllu/storage-indexeddb';

const logger = createLogger({
  transport: createHttpTransport({ url: '/api/logs' }),
  storage: createIndexedDbStorage(),
});

function ExampleButton() {
  const logger = useLogger();

  return (
    <button
      onClick={() => logger.info('interaction:cta_click', { source: 'hero' })}
    >
      Log CTA click
    </button>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <LoggerProvider logger={logger}>{children}</LoggerProvider>;
}
```

### Provider Options

| Prop | Type | Description |
|------|------|-------------|
| `logger` | `Logger` | Pre-configured logger instance (sync). |
| `options` | `LoggerOptions` | Alternative to `logger` – will call `createLogger(options)` internally. |
| `onError` | `(error) => void` | Handle logger initialization errors (e.g., IndexedDB blocked). |

## Nx Tasks

| Command | Description |
|---------|-------------|
| `pnpm nx build @ayllu/react` | Compile the React bindings. |
| `pnpm nx test @ayllu/react` | Run component-level tests via Vitest + React Testing Library. |
| `pnpm nx lint @ayllu/react` | Lint the package. |

## Devtools & Observers

The provider surfaces the core observer bus on context. You can subscribe to `logger.events` to power in-app consoles or send telemetry to preview dashboards:

```ts
const subscription = logger.events.subscribe(({ type, payload }) => {
  // Render to a devtools panel, or forward to analytics
});

return () => subscription.unsubscribe();
```

See `examples/next-app` for an integration example inside a Next.js App Router layout.
