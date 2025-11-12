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

## 4. Automated releases with GitHub Actions

The repository includes GitHub Actions workflows that automate the entire release process:

### Workflows

- **CI** (`.github/workflows/ci.yml`) – Runs on every PR and push to `main`:
  - Lints all packages
  - Runs tests
  - Builds all packages

- **Validate Changesets** (`.github/workflows/changeset-validator.yml`) – Runs on PRs:
  - Ensures every PR includes a changeset file
  - Validates changeset format

- **Release** (`.github/workflows/release.yml`) – Runs on pushes to `main`:
  - Detects pending changesets
  - Creates a "Version Packages" PR with version bumps
  - When the PR is merged, automatically publishes to npm

### Setup

1. **Add npm token to GitHub Secrets**:
   - Go to your repository Settings → Secrets and variables → Actions
   - Add a new secret named `NPM_TOKEN` with your npm access token
   - Generate a token at https://www.npmjs.com/settings/YOUR_USERNAME/access-tokens

2. **Workflow**:
   - Create a PR with your changes and a changeset (`pnpm changeset`)
   - The validator ensures a changeset exists
   - After merge to `main`, the release workflow creates a version PR
   - Merge the version PR to trigger automatic publishing to npm

### Manual release (optional)

You can still release manually if needed:

```bash
pnpm version-packages
git add -A
git commit -m "chore: release packages"
git push --follow-tags
pnpm publish-packages
```

This keeps your local workflow lightweight while ensuring reproducible releases in continuous delivery.


