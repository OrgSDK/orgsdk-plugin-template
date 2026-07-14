# Release & catalog promotion

## Publishing model: automatic on main (opt-in)

This template ships a `publish-catalog.yml` workflow that new official plugins
inherit. A push (or PR merge) to `main` that touches **publishable artifact
content** automatically performs a **real, authenticated** catalog publish —
**but only when the repo variable `ORGSDK_ENABLE_CATALOG_PUBLISH` is set to
`true`**.

> **This template repo ships without that variable**, so it never publishes the
> placeholder `my-plugin`. A repo generated from the template opts in by
> creating the variable and setting it to `true`.

The workflow triggers on `push` to `main` for these paths:

- `plugin/**` — the shipped plugin source (the staged artifact).
- `package.json` — feeds the generated artifact `package.json`
  (`name`, `type`, `dependencies`).

A push that changes only docs, tests, workflows, README, or scripts does **not**
trigger a publish.

Publishing never runs on pull-request code — only on the `push` to `main`
event (the merged commit). `workflow_dispatch` remains available for
dry-runs and manual recovery.

## Publish opt-in gate

Real publishing (automatic **and** manual) is gated on the repo variable
`ORGSDK_ENABLE_CATALOG_PUBLISH == 'true'`. Exact behavior:

- **Push to main, gate enabled** → full publish.
- **Push to main, gate disabled/unset** → the publish job is skipped at the
  job level; the `catalog-publish` environment is never requested, so **no
  secrets are accessed** (clean skip — CI still validates the build).
- **Manual `dry_run=true`** → always builds + previews the payload (no POST),
  regardless of the gate. Usable even before the gate is enabled.
- **Manual `dry_run=false`** → requires the gate; fails clearly with an error
  if `ORGSDK_ENABLE_CATALOG_PUBLISH != 'true'`.

The safe choice: **manual real publish also requires opt-in.** This guarantees a
repo that should never publish (e.g. this template publishing placeholder
`my-plugin`) cannot publish by any path until the variable is created.

## Required repository settings (configure after creating a plugin)

These are configured in the new repo's GitHub **Settings**, not in the repo
files. The template contains no real credentials or endpoints.

| Setting | Where | Value |
|---|---|---|
| `ORGSDK_ENABLE_CATALOG_PUBLISH` | Settings → Secrets and variables → **Variables** | `true` (opt in to publishing) |
| `ORGSDK_CATALOG_URL` | Settings → Secrets and variables → **Variables** | your catalog base URL |
| `ORGSDK_PUBLISH_TOKEN` | repository secret **or** `catalog-publish` environment secret | admin JWT (secret) |
| `catalog-publish` environment | Settings → Environments | deployment branches restricted to `main` (see below) |

Environment configuration for `catalog-publish` (fully automatic publishing):

- **Deployment branches** — restrict to `main`.
- **Required reviewers** — leave **OFF** by default. A reviewer gate makes
  publishing approval-based rather than automatic; enable it only as a
  temporary emergency pause.
- A repository-level `ORGSDK_PUBLISH_TOKEN` is sufficient — there is no need
  to re-add the secret to the environment. An environment-level secret is also
  supported and takes precedence if both exist.

Until these are configured, the automatic path fails clearly at the
token/URL checks **without** publishing. The token is injected by GitHub (from
the repository or the environment); it is never printed or written to logs.

## Why the workflow runs its own verification

The publish workflow runs its **own** full verification (typecheck + lint +
tests + validate + package) instead of depending on the `CI` workflow's
status check. It must build the artifact to publish anyway, and a
self-contained build is robust against CI job-name changes, cancellations, and
status-check bypass races (defense in depth). The redundant build on a tiny
plugin repo is an acceptable cost.

## Version policy

- The manifest version (`plugin/.plugin.json` → `version`) is the **source of
  truth** for the catalog. `package.json` → `version` is kept in sync (enforced
  by the CI version guard).
- Bump the version on **every** publishable content change. The CI version
  guard (`scripts/check-version-bump.ts`, run as `bun run version-guard`)
  fails a PR/commit if publishable content changed but the manifest version
  did not. Docs/workflow/scripts-only changes do **not** require a bump.
- Versions are **write-once** in the catalog: re-publishing the same
  `(slug, version)` with identical content is idempotent; different content is
  rejected with HTTP 409. Always bump the version for changed content.

## Manual dry-run / recovery

Run `Publish to Catalog` → `Run workflow` with `dry_run = true` (default).
This packages, validates, and prints the payload **without** POSTing. It does
not require `ORGSDK_PUBLISH_TOKEN`. Select `dry_run = false` to force a real
publish manually (requires the token).

## The artifact

`bun run package` produces:

```
dist/
├── <slug>/                         # staged plugin folder (manifest name)
│   ├── .plugin.json
│   ├── package.json                # generated: name, version, type, runtime deps only
│   ├── index.ts
│   ├── auth-provider.ts
│   ├── functions.ts
│   └── docs/overview.md
├── <slug>-<version>.manifest.json  # file list + SHA-256 checksums (sorted)
└── <slug>-<version>.tgz            # tarball of the plugin folder
```

The generated `package.json` inside `dist/<slug>/` carries only the plugin's
runtime dependencies (from the repo root `package.json` → `dependencies`).
No devDependencies, scripts, or private flag. Packaging is deterministic:
`dist/` is fully removed and recreated on every run.
