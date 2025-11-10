import { cloneDeep } from './utils';
import type { LogRecord, StorageLike } from './types';

interface InFlightEntry {
  log: LogRecord;
  reservedAt: number;
}

/**
 * Lightweight in-memory storage that fulfils the StorageLike contract.
 * Useful for SSR, testing and as a fallback when IndexedDB is unavailable.
 */
export class MemoryStorage implements StorageLike {
  private queue: LogRecord[] = [];
  private inflight: Map<string, InFlightEntry> = new Map();

  constructor(private readonly capacity = 1_000) {}

  async push(items: LogRecord[]): Promise<void> {
    for (const item of items) {
      if (this.queue.length >= this.capacity) {
        // Drop the oldest entry to make room.
        this.queue.shift();
      }

      // Avoid duplicating entries already in-flight.
      if (this.inflight.has(item.id)) {
        continue;
      }

      this.queue.push(cloneDeep(item));
    }
  }

  async take(max: number): Promise<LogRecord[]> {
    if (max <= 0) {
      return [];
    }

    const batch: LogRecord[] = [];
    while (batch.length < max && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) {
        break;
      }

      this.inflight.set(next.id, {
        log: cloneDeep(next),
        reservedAt: Date.now(),
      });
      batch.push(next);
    }

    return batch;
  }

  async drop(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.inflight.delete(id);
    }
  }

  /**
   * Re-queues a batch previously returned by take(). Useful when a transport fails.
   */
  async requeue(items: LogRecord[]): Promise<void> {
    for (const item of items) {
      this.inflight.delete(item.id);
    }
    await this.push(items);
  }

  async size(): Promise<number> {
    return this.queue.length + this.inflight.size;
  }
}

export const createMemoryStorage = (capacity?: number): MemoryStorage =>
  new MemoryStorage(capacity);


