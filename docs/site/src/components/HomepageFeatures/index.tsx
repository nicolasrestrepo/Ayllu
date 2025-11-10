import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Privacy-first by default',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Chainable policies redact, truncate, or drop sensitive fields before
        logs hit persistence or the network. Enforce schemas with Zod and record
        why payloads were rejected.
      </>
    ),
  },
  {
    title: 'Offline resilience built in',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        IndexedDB queues, exponential backoff with jitter, and health checks
        keep telemetry flowing even during flaky connections or vendor outages.
      </>
    ),
  },
  {
    title: 'Pluggable transports & storages',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Adapters encapsulate vendor protocols. Swap HTTP transports, add OTLP or
        Loki, and reuse the same logging API across browser, SSR, or native
        surfaces.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
