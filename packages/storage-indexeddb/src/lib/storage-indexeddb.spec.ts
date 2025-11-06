import { storageIndexeddb } from './storage-indexeddb';

describe('storageIndexeddb', () => {
  it('should work', () => {
    expect(storageIndexeddb()).toEqual('storage-indexeddb');
  });
});
