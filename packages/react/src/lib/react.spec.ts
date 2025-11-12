import { LoggerProvider, useLogger, useLoggerEvent, withLogger } from './react';

describe('react', () => {
  it('should export LoggerProvider', () => {
    expect(LoggerProvider).toBeDefined();
    expect(typeof LoggerProvider).toBe('function');
  });

  it('should export useLogger', () => {
    expect(useLogger).toBeDefined();
    expect(typeof useLogger).toBe('function');
  });

  it('should export useLoggerEvent', () => {
    expect(useLoggerEvent).toBeDefined();
    expect(typeof useLoggerEvent).toBe('function');
  });

  it('should export withLogger', () => {
    expect(withLogger).toBeDefined();
    expect(typeof withLogger).toBe('function');
  });
});
