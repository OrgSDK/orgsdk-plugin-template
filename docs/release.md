# Release & catalog promotion

## Current state: no production side effects

This repository has **no publish credentials** and **no catalog-publishing
workflow**. The CI pipeline produces a local artifact (`dist/`) uploaded as
a GitHub Actions artifact — nothing leaves GitHub.

## The artifact

`bun run package` (run in CI) produces:

```
dist/
├── <slug>/                         # staged plugin folder (manifest name)
│   ├── .plugin.json
│   ├── package.json                # generated: name, version, type, runtime deps only
│   ├── index.ts
│   ├── auth-provider.ts
│   ├── functions.ts
│   ├── contract.ts
│   └── docs/overview.md
├── <slug>-<version>.manifest.json  # file list + SHA-256 checksums (sorted)
└── <slug>-<version>.tgz            # tarball of the plugin folder
```

The generated `package.json` inside `dist/<slug>/` carries only the plugin's
runtime dependencies (from the repo root `package.json` → `dependencies`).
No devDependencies, scripts, or private flag. The catalog's `readPluginFolder`
reads this to resolve deps at materialise time.

Packaging is deterministic: `dist/` is fully removed and recreated on every
run (stale files cannot survive), and file traversal + manifest entries are
sorted by path.

## Future catalog promotion (protected, manual)

When the catalog cutover safety work ships, a **protected** promotion step
will be added. Expected contract:

1. **Trigger:** manual `workflow_dispatch` on a tagged release
   (`v<version>`), not on every push.
2. **Gate:** the workflow runs in an environment with catalog admin
   credentials (stored as GitHub secrets, not in the repo).
3. **Action:** `POST /api/plugins` with the artifact tarball (or the file
   set) and an admin JWT.
4. **Visibility:** the workflow does NOT push to tenants. Publish is
   catalog-only — installed tenants stay pinned to their current version
   until they update.
5. **Audit:** the platform logs a `plugin.publish` event with slug + version.

This step is intentionally **not** implemented in this pass.

## Version policy

- The manifest version (`.plugin.json` → `version`) is the **source of
  truth** for the catalog. Bump it on every behavior change.
- Versions are **write-once** in the catalog's history table: re-publishing
  the same version updates mutable fields but does not create a new entry.
- There is no rollback path yet — treat every publish as forward-only.
