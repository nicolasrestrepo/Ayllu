# @ayllu/storage-indexeddb

`@ayllu/storage-indexeddb` provides an offline-first queue implementation for browsers. It fulfils the `StorageLike` interface from `@ayllu/core`, persisting logs to IndexedDB so they can be flushed once connectivity returns.

## Features

- Robust queue semantics (`push`, `take`, `drop`) backed by IndexedDB.
- Graceful fallback to in-memory storage when IndexedDB is unavailable or blocked.
- Configurable database + store names, batch sizes, and TTL pruning.
- Support for serialization hooks to encrypt or compress entries at rest.

## Usage

```ts
import { createLogger } from '@ayllu/core';
import { createIndexedDbStorage } from '@ayllu/storage-indexeddb';

const storage = createIndexedDbStorage({
  dbName: 'ayllu-logs',
  storeName: 'queue',
  version: 1,
  serialize: (log) => JSON.stringify(log),
  deserialize: (raw) => JSON.parse(raw),
});

const logger = createLogger({ storage });
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dbName` | `string` | `'ayllu-logs'` | Database name used for the queue. |
| `storeName` | `string` | `'queue'` | Object store where log entries are stored. |
| `version` | `number` | `1` | IndexedDB version (used for schema upgrades). |
| `serialize` | `(log: Log) => IDBValidKey | ArrayBuffer | string` | `JSON.stringify` | Transform log objects before storage. |
| `deserialize` | `(stored) => Log` | `JSON.parse` | Reverse of `serialize`. |
| `maxBatchSize` | `number` | `50` | Upper bound when `take()` retrieves logs for flushing. |
| `prune` | `(entries) => entries` | — | Optional clean-up logic (e.g., TTL or custom compaction). |

## Nx Tasks

| Command | Description |
|---------|-------------|
| `pnpm nx build @ayllu/storage-indexeddb` | Compile the storage adapter. |
| `pnpm nx test @ayllu/storage-indexeddb` | Execute IndexedDB integration tests under Vitest + jsdom. |
| `pnpm nx lint @ayllu/storage-indexeddb` | Lint source files with shared rules. |

## Notes

- When used in SSR contexts, guard access to `window` and `indexedDB` (lazy initialization is built in).
- Combine with `createMemoryStorage()` as a fallback in persistence-restricted environments.
- Future adapters can reuse this contract to target WebSQL, Service Workers, or React Native AsyncStorage.
