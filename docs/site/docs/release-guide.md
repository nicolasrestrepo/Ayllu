---
id: release-guide
title: Release & Publish
sidebar_position: 7
---

The workspace uses [Changesets](https://github.com/changesets/changesets) to orchestrate version bumps and public releases across every package.

## 1. Record a changeset

Run the interactive prompt and select the packages that changed:

```bash
pnpm changeset
```

Choose the appropriate bump (`patch`, `minor`, or `major`) and describe the change. The CLI creates a markdown file under `.changeset/` that lives with your PR.

## 2. Apply versions

When you are ready to cut a release (usually on `main`), apply all pending changesets:

```bash
pnpm version-packages
```

This command:

- bumps the affected `package.json` versions,
- updates dependency ranges between local packages,
- refreshes `pnpm-lock.yaml` so CI/CD stays deterministic.

Commit the resulting changes and push with tags:

```bash
git add -A
git commit -m "chore: release packages"
git push --follow-tags
```

## 3. Publish

Publishing works with pnpm, npm or yarn—the registry is the same. The repo exposes a helper that publishes every package with pending releases:

```bash
pnpm publish-packages
```

By default packages are published with public access. You can still publish individual packages manually:

```bash
pnpm publish --filter @ayllu/core
# or
cd packages/core && npm publish --access public
```

## 4. Automate in CI

For automation, wire the [Changesets GitHub Action](https://github.com/changesets/action) or an Nx release pipeline:

1. Run `pnpm changeset version` on merge to `main`.
2. Let CI build/test.
3. Execute `pnpm changeset publish` with an npm token.

This keeps your local workflow lightweight while ensuring reproducible releases in continuous delivery.


