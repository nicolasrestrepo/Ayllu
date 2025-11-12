import { createLogger } from './core';

describe('core', () => {
  it('should export createLogger', () => {
    expect(typeof createLogger).toBe('function');
  });

  it('should create a logger instance', () => {
    const logger = createLogger({
      transports: [],
    });
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});
