import type { LogRecord, StorageLike } from '@ayllu/core';
import { createMemoryStorage, MemoryStorage } from '@ayllu/core';

export interface IndexedDbStorageOptions {
  dbName?: string;
  storeName?: string;
  version?: number;
  serialize?: (log: LogRecord) => Promise<string> | string;
  deserialize?: (raw: string) => Promise<LogRecord> | LogRecord;
  encrypt?: (payload: string) => Promise<string> | string;
  decrypt?: (payload: string) => Promise<string> | string;
  maxQueueLength?: number;
  warn?: (message: string) => void;
}

interface PersistedLog {
  id: string;
  payload: string;
  createdAt: number;
  reservedAt?: number | null;
}

const defaultSerialize = (log: LogRecord): string =>
  JSON.stringify(log);

const defaultDeserialize = (raw: string): LogRecord =>
  JSON.parse(raw) as LogRecord;

const isIndexedDbAvailable = (): boolean =>
  typeof indexedDB !== 'undefined';

const promisifyRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const openDatabase = (
  dbName: string,
  storeName: string,
  version: number
): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, {
          keyPath: 'id',
        });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export class IndexedDbStorage implements StorageLike {
  private readonly dbPromise?: Promise<IDBDatabase>;
  private readonly memoryFallback: MemoryStorage | undefined;
  private readonly serialize: Required<IndexedDbStorageOptions>['serialize'];
  private readonly deserialize: Required<IndexedDbStorageOptions>['deserialize'];
  private readonly encrypt?: IndexedDbStorageOptions['encrypt'];
  private readonly decrypt?: IndexedDbStorageOptions['decrypt'];
  private readonly maxQueueLength: number;
  private readonly warn: (message: string) => void;

  constructor(private readonly options: IndexedDbStorageOptions = {}) {
    this.serialize = options.serialize ?? defaultSerialize;
    this.deserialize = options.deserialize ?? defaultDeserialize;
    this.encrypt = options.encrypt;
    this.decrypt = options.decrypt;
    this.maxQueueLength = options.maxQueueLength ?? 5_000;
    this.warn = options.warn ?? console.warn;

    if (isIndexedDbAvailable()) {
      this.dbPromise = openDatabase(
        options.dbName ?? 'ayllu-logs',
        options.storeName ?? 'queue',
        options.version ?? 1
      );
    } else {
      this.memoryFallback = createMemoryStorage();
      this.warn(
        '[Ayllu] IndexedDB is unavailable, falling back to in-memory storage.'
      );
    }
  }

  private async encode(log: LogRecord): Promise<PersistedLog> {
    const serialized = await this.serialize(log);
    const payload = this.encrypt
      ? await this.encrypt(serialized)
      : serialized;
    return {
      id: log.id,
      payload,
      createdAt: log.timestamp,
      reservedAt: null,
    };
  }

  private async decode(record: PersistedLog): Promise<LogRecord> {
    const decrypted = this.decrypt
      ? await this.decrypt(record.payload)
      : record.payload;
    return this.deserialize(decrypted);
  }

  private async withStore<T>(
    mode: IDBTransactionMode,
    executor: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    if (this.memoryFallback) {
      throw new Error('IndexedDB not available');
    }

    const db = await this.dbPromise!;
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(
        this.options.storeName ?? 'queue',
        mode
      );
      const store = tx.objectStore(this.options.storeName ?? 'queue');
      let resolved = false;

      const finish = (value: T) => {
        resolved = true;
        resolve(value);
      };

      Promise.resolve(executor(store))
        .then(finish)
        .catch((error) => {
          if (tx.error) {
            reject(tx.error);
          } else {
            reject(error);
          }
          try {
            tx.abort();
          } catch {
            // ignore abort errors
          }
        });

      tx.oncomplete = () => {
        if (!resolved) {
          resolve(undefined as T);
        }
      };
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  async push(items: LogRecord[]): Promise<void> {
    if (this.memoryFallback) {
      await this.memoryFallback.push(items);
      return;
    }

    await this.withStore('readwrite', async (store) => {
      const currentSize = await promisifyRequest(store.count());
      if (currentSize + items.length > this.maxQueueLength) {
        this.warn('[Ayllu] IndexedDB queue at capacity, dropping oldest items.');
        const overflow = currentSize + items.length - this.maxQueueLength;
        await this.trimOldest(store, overflow);
      }

      for (const item of items) {
        const encoded = await this.encode(item);
        store.put(encoded);
      }
    });
  }

  private async trimOldest(store: IDBObjectStore, toRemove: number) {
    const index = store.index('createdAt');
    await new Promise<void>((resolve, reject) => {
      let removed = 0;
      const cursorRequest = index.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || removed >= toRemove) {
          resolve();
          return;
        }
        cursor.delete();
        removed += 1;
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  async take(max: number): Promise<LogRecord[]> {
    if (this.memoryFallback) {
      return this.memoryFallback.take(max);
    }

    return this.withStore('readwrite', (store) => {
      const index = store.index('createdAt');
      const results: LogRecord[] = [];

      return new Promise<LogRecord[]>((resolve, reject) => {
        const cursorRequest = index.openCursor();

        cursorRequest.onsuccess = async () => {
          const cursor = cursorRequest.result;
          if (!cursor || results.length >= max) {
            resolve(results);
            return;
          }

          const record = cursor.value as PersistedLog;
          if (record.reservedAt) {
            cursor.continue();
            return;
          }

          record.reservedAt = Date.now();
          cursor.update(record);

          try {
            const decoded = await this.decode(record);
            results.push(decoded);
          } catch (error) {
            // Failed to decode; delete the bad record.
            cursor.delete();
            this.warn(
              `[Ayllu] Failed to decode IndexedDB log entry ${record.id}: ${String(
                error
              )}`
            );
          }

          cursor.continue();
        };

        cursorRequest.onerror = () => reject(cursorRequest.error);
      });
    });
  }

  async drop(ids: string[]): Promise<void> {
    if (this.memoryFallback) {
      await this.memoryFallback.drop(ids);
      return;
    }

    await this.withStore('readwrite', async (store) => {
      for (const id of ids) {
        store.delete(id);
      }
    });
  }
}

export const createIndexedDbStorage = (
  options?: IndexedDbStorageOptions
): StorageLike => new IndexedDbStorage(options);
