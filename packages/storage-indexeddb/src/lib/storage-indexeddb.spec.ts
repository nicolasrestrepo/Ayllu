import { IndexedDbStorage, createIndexedDbStorage } from './storage-indexeddb';

describe('storageIndexeddb', () => {
  it('should export IndexedDbStorage', () => {
    expect(IndexedDbStorage).toBeDefined();
  });

  it('should export createIndexedDbStorage', () => {
    expect(typeof createIndexedDbStorage).toBe('function');
  });

  it('should create an IndexedDB storage instance', () => {
    const storage = createIndexedDbStorage();
    expect(storage).toBeDefined();
    expect(typeof storage.push).toBe('function');
    expect(typeof storage.take).toBe('function');
    expect(typeof storage.drop).toBe('function');
  });
});
