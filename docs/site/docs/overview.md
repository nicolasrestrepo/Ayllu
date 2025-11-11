---
id: overview
title: Overview
sidebar_position: 1
---

![Ayllu logo](/img/ayllu-logo.png)

Ayllu is a frontend-first observability SDK that unifies logging, batching, privacy policies, storage, and transport adapters. The goal is to let web and mobile apps instrument telemetry once and deliver it to any vendor (or internal pipeline) without rewriting code.

## Platform goals

- **Vendor agnostic pipeline** – transports translate batches into vendor protocols. Swap adapters without touching application code.
- **Privacy first** – policies redact, truncate, or drop sensitive fields before they leave the runtime. Sampling keeps noisy data under control.
- **Offline resilience** – storage strategies queue logs in memory or IndexedDB and retry delivery with backoff + jitter.
- **Extensibility** – enrichers, observers, and custom policies unlock bespoke behaviours and devtools integrations.

## Security guardrails

- **Prototype-safe contexts** – records are coerced into plain objects, preventing prototype pollution when ingesting untrusted data.
- **Payload size enforcement** – the logger drops any record whose UTF-8 serialisation exceeds the configured limit (64&nbsp;KiB by default).
- **Schema enforcement** – bring your own Zod schema to block malformed or unexpected inputs.
- **Layered policies** – redact, truncate, or drop sensitive content before persistence or transport.
- **Signed proxy endpoints** – the sample Next.js app validates signatures before shipping logs upstream.

## Release workflow

The monorepo ships with [Changesets](https://github.com/changesets/changesets) preconfigured for public npm publishing:

1. `pnpm changeset` – describe changes and bump types for affected packages.
2. `pnpm version-packages` – apply pending changesets, bump versions, and refresh the lockfile.
3. `pnpm publish-packages` – publish all unreleased packages to npm with public access (pnpm/yarn/npm clients all target the same registry).
4. Push with tags (`git push --follow-tags`) so consumers receive the release metadata.

## Package map

| Package | Purpose |
|---------|---------|
| `@ayllu/core` | Logger factory, batching engine, policies, storage/transport abstractions. |
| `@ayllu/transport-http` | Fetch-based adapter targeting proxy endpoints or vendors. |
| `@ayllu/storage-indexeddb` | Offline storage backed by IndexedDB with optional encryption hooks. |
| `@ayllu/react` | Provider and hooks for React/Next.js apps. |
| `examples/next-app` | Reference implementation with a secure `/api/logs` proxy. |

The rest of this guide dives into each package and highlights recommended configuration patterns.

> See the repository-level [Architecture overview](https://github.com/nicolasrestrepo/Ayllu/blob/main/docs/architecture.md) for a deeper discussion of the clean architecture patterns that structure Ayllu.
