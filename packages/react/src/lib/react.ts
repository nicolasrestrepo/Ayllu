import { createLogger } from '@ayllu/core';
import type {
  Logger,
  LoggerEventListener,
  LoggerEventType,
  LoggerOptions,
} from '@ayllu/core';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';

const LoggerContext = createContext<Logger | null>(null);

export interface LoggerProviderProps extends PropsWithChildren {
  logger?: Logger;
  options?: LoggerOptions;
  onError?: (error: unknown) => void;
}

export const LoggerProvider = ({
  logger,
  options,
  onError,
  children,
}: LoggerProviderProps) => {
  const managedLogger = useMemo(() => {
    if (logger) {
      return logger;
    }

    if (!options) {
      throw new Error(
        'LoggerProvider requires either a logger instance or options to create one.'
      );
    }

    return createLogger({
      ...options,
      onError: onError ?? options.onError,
    });
  }, [logger, options, onError]);

  useEffect(() => {
    if (logger) {
      return;
    }

    return () => {
      void managedLogger.shutdown();
    };
  }, [logger, managedLogger]);

  if (!managedLogger) {
    throw new Error(
      'LoggerProvider failed to initialise the logger. Provide either a logger instance or options.'
    );
  }

  return (
    <LoggerContext.Provider value={managedLogger}>
      {children}
    </LoggerContext.Provider>
  );
};

export const useLogger = (): Logger => {
  const ctx = useContext(LoggerContext);
  if (!ctx) {
    throw new Error('useLogger must be used within a LoggerProvider.');
  }
  return ctx;
};

export const useLoggerEvent = <T extends LoggerEventType>(
  type: T,
  listener: LoggerEventListener<T>,
  deps: unknown[] = []
) => {
  const logger = useLogger();
  const stableListener = useRef(listener);
  stableListener.current = listener;

  useEffect(() => {
    const unsubscribe = logger.events.subscribe((event) => {
      stableListener.current(event as Parameters<typeof listener>[0]);
    }, type);

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logger, type, ...deps]);
};

export const withLogger = <P extends { logger: Logger }>(
  Component: React.ComponentType<P>
) => {
  return function WithLogger(props: Omit<P, 'logger'>) {
    const logger = useLogger();
    return <Component {...(props as P)} logger={logger} />;
  };
};
