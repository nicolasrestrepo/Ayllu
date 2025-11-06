import { transportHttp } from './transport-http';

describe('transportHttp', () => {
  it('should work', () => {
    expect(transportHttp()).toEqual('transport-http');
  });
});
