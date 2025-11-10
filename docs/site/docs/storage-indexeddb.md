---
id: storage-indexeddb
title: "@ayllu/storage-indexeddb"
sidebar_position: 4
---

`@ayllu/storage-indexeddb` provides an offline-first queue that persists logs in IndexedDB. It tracks in-flight entries, supports optional encryption hooks, and falls back to the in-memory queue when IndexedDB is unavailable or blocked.

## Usage

```ts
import { createIndexedDbStorage } from '@ayllu/storage-indexeddb';

const storage = createIndexedDbStorage({
  dbName: 'ayllu-demo',
  storeName: 'logs',
  maxQueueLength: 5000,
  encrypt: async (payload) => encryptPayload(payload),
  decrypt: async (payload) => decryptPayload(payload),
});

const logger = createLogger({ transport, storage });
```

The helper gracefully falls back to the in-memory queue and emits a warning when IndexedDB is unavailable (e.g. server-side rendering, private browsing with storage disabled).

## Serialization & encryption

- `serialize` / `deserialize` let you transform log records before writing to disk (defaults to `JSON.stringify` / `JSON.parse`).
- `encrypt` / `decrypt` receive the serialized payload. The demo implementation uses WebCrypto AES-GCM when available and base64 encoding otherwise. Plug in a more robust key management strategy in production.

## Queue semantics

- `push` writes logs into the queue and evicts the oldest entries when capacity is exceeded.
- `take` returns the next `max` entries and marks them as reserved to avoid duplicate delivery.
- `drop` removes entries after successful delivery. When transports fail, the core logger re-queues the batch so the storage can retry later.

> For React Native or hybrid apps, implement a compatible storage strategy (e.g. AsyncStorage) by conforming to the same `StorageLike` interface exposed by `@ayllu/core`.
