import { createHttpTransport, HttpTransportError } from './transport-http';

describe('transportHttp', () => {
  it('should export createHttpTransport', () => {
    expect(typeof createHttpTransport).toBe('function');
  });

  it('should export HttpTransportError', () => {
    expect(HttpTransportError).toBeDefined();
  });

  it('should create an http transport instance', () => {
    const transport = createHttpTransport({
      url: 'https://example.com/logs',
    });
    expect(transport).toBeDefined();
    expect(typeof transport.send).toBe('function');
    expect(typeof transport.healthy).toBe('function');
  });
});
