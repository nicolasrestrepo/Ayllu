---
id: ayllu-react
title: "@ayllu/react"
sidebar_position: 5
---

The React bindings wrap the core logger behind a context provider and a tiny hook. They keep SSR-friendly defaults and clean up resources automatically.

## Provider

```tsx
'use client';

import { LoggerProvider } from '@ayllu/react';
import { createLogger } from '@ayllu/core';
import { createHttpTransport } from '@ayllu/transport-http';
import { createIndexedDbStorage } from '@ayllu/storage-indexeddb';

const logger = createLogger({
  transport: createHttpTransport({ url: '/api/logs' }),
  storage: createIndexedDbStorage(),
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <LoggerProvider logger={logger}>{children}</LoggerProvider>;
}
```

You can omit the `logger` prop and pass `options`; the provider will create and dispose the instance for you:

```tsx
<LoggerProvider
  options={{
    transport: createHttpTransport({ url: '/api/logs' }),
    storage: createIndexedDbStorage(),
    policies: [...],
  }}
>
  {children}
</LoggerProvider>
```

## Hooks & helpers

- `useLogger()` returns the logger instance. It throws if you call it outside of `LoggerProvider` (helpful during testing).
- `useLoggerEvent(type, listener, deps)` subscribes to the observer bus and automatically unsubscribes during cleanup. Perfect for devtools overlays or debugging widgets.
- `withLogger(Component)` injects the `logger` prop into class components.

> Do not invoke the logger during rendering; call it from event handlers, effects, or callbacks.
