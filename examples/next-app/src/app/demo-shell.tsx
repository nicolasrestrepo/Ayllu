'use client';

import { useLogger, useLoggerEvent } from '@ayllu/react';
import { useState } from 'react';

import styles from './page.module.css';

type FeedEntry = {
  id: string;
  level: string;
  message: string;
  context?: unknown;
  reason?: string;
};

const demoUser = {
  id: 'user-4242',
  email: 'alice@example.com',
  plan: 'pro',
  auth: {
    token: 'demo-token-should-be-redacted',
  },
};

const createOrder = () => ({
  orderId: `order_${Date.now()}`,
  amountUsd: Number((Math.random() * 250 + 25).toFixed(2)),
  items: [
    { sku: 'SDK_PLUS', qty: 1 },
    { sku: 'SUPPORT', qty: 1 },
  ],
});

const useEventFeed = () => {
  const [entries, setEntries] = useState<FeedEntry[]>([]);

  useLoggerEvent(
    'queued',
    ({ log }) => {
      setEntries((current) => [
        {
          id: log.id,
          level: log.level,
          message: log.message,
          context: log.context,
        },
        ...current.slice(0, 9),
      ]);
    },
    []
  );

  useLoggerEvent(
    'dropped',
    ({ log, reason }) => {
      setEntries((current) => [
        {
          id: `${log.id}-dropped`,
          level: `${log.level} (dropped)`,
          message: log.message,
          context: log.context,
          reason,
        },
        ...current.slice(0, 9),
      ]);
    },
    []
  );

  useLoggerEvent(
    'flush-error',
    ({ batch, error }) => {
      setEntries((current) => [
        {
          id: `flush-error-${Date.now()}`,
          level: 'error',
          message: 'Transport flush failed',
          context: {
            error: (error as Error)?.message ?? error,
            batchSize: batch.length,
          },
        },
        ...current.slice(0, 9),
      ]);
    },
    []
  );

  return entries;
};

const LevelBadge = ({ level }: { level: string }) => (
  <span className={`${styles.level} ${styles[level.toLowerCase()]}`}>
    {level.toUpperCase()}
  </span>
);

const EventFeed = () => {
  const entries = useEventFeed();

  if (!entries.length) {
    return (
      <div className={styles.feedEmpty}>
        Events will appear here after you interact with the controls.
      </div>
    );
  }

  return (
    <ul className={styles.feedList}>
      {entries.map((entry) => (
        <li key={entry.id} className={styles.feedItem}>
          <header>
            <LevelBadge level={entry.level} />
            <span className={styles.message}>{entry.message}</span>
          </header>
          <pre className={styles.context}>
            {JSON.stringify(entry.context, null, 2)}
          </pre>
          {entry.reason ? (
            <p className={styles.reason}>
              Dropped: <code>{entry.reason}</code>
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

const Controls = () => {
  const logger = useLogger();

  const emitPageView = () => {
    logger.info('ui:page_view', {
      path:
        typeof window !== 'undefined'
          ? window.location.pathname
          : '/examples',
      user: demoUser,
      marketing: {
        campaign: 'demo',
        source: 'self-serve',
      },
    });
  };

  const emitCheckout = () => {
    const order = createOrder();
    logger.warn('checkout:abandoned', {
      user: demoUser,
      order,
      stage: 'payment',
    });
  };

  const emitError = () => {
    try {
      throw new Error('Payment gateway rejected card 4001');
    } catch (error) {
      logger.error(
        'checkout:payment_failed',
        {
          user: demoUser,
          order: createOrder(),
        },
        error
      );
    }
  };

  return (
    <div className={styles.controls}>
      <h2>Emit telemetry</h2>
      <p>
        Interact with the buttons to generate logs. Privacy policies redact
        e-mails and tokens before the payload leaves the browser.
      </p>
      <div className={styles.buttonGrid}>
        <button type="button" onClick={emitPageView}>
          Log page view
        </button>
        <button type="button" onClick={emitCheckout}>
          Log checkout abandoned
        </button>
        <button type="button" className={styles.danger} onClick={emitError}>
          Log simulated error
        </button>
      </div>
    </div>
  );
};

const SecurityCallouts = () => (
  <div className={styles.security}>
    <h2>Security posture</h2>
    <ul>
      <li>Input schema enforced via Zod before any enrichment.</li>
      <li>
        Privacy policies redact tokens and emails prior to persistence or
        transport.
      </li>
      <li>IndexedDB payloads encoded (AES-GCM when WebCrypto is available).</li>
      <li>
        HTTP transport targets a proxy endpoint that validates signatures before
        forwarding.
      </li>
      <li>Observer hooks expose queue, drop, and retry events for monitoring.</li>
    </ul>
  </div>
);

const DemoShell = () => (
  <main className={styles.page}>
    <section className={styles.hero}>
      <h1>Ayllu logging demo</h1>
      <p>
        Trigger structured logs, watch policies redact sensitive fields, and
        inspect how batches flow through storage and the HTTP proxy.
      </p>
    </section>
    <div className={styles.grid}>
      <Controls />
      <div className={styles.feed}>
        <h2>Live event feed</h2>
        <EventFeed />
      </div>
      <SecurityCallouts />
    </div>
  </main>
);

export default DemoShell;

