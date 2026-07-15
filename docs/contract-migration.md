# Contract migration — completed

## Status: consuming `@orgsdk/plugins` from npm

This template imports its authoring types from the public
[`@orgsdk/plugins`](https://www.npmjs.com/package/@orgsdk/plugins) npm package.
New plugins created from this template start with the right contract from day
one.

## What changed

1. **`plugin/contract.ts` deleted** — no local shim needed.
2. **All imports** use `import type { … } from "@orgsdk/plugins"`.
3. **devDependency** is the published npm package, pinned to an exact version
   (`@orgsdk/plugins@0.2.0`) for reproducibility at this early contract stage.
4. **Purity guards** allow `@orgsdk/plugins` type-only imports; value imports
   and all other `@orgsdk/*` packages are blocked.
5. **Artifact purity** — the runtime artifact carries `zod` but NOT
   `@orgsdk/plugins` (type-only imports are erased at compile time).
6. **Manifest `$schema`** — `plugin/.plugin.json` declares
   `$schema: https://orgsdk.ai/schemas/plugin-manifest.v1.json` for editor
   completion and schema validation.
7. **No local management scripts** — `validate`, `package`, `version-guard`,
   and `publish` are npm scripts that delegate to the `orgsdk-plugin` CLI
   shipped by `@orgsdk/plugins`. The old `scripts/*.ts` shims are removed.
8. **Reusable CI/CD workflows** — `.github/workflows/ci.yml` and
   `publish-catalog.yml` call the centrally maintained reusable workflows in
   `OrgSDK/plugins` (pinned to an immutable commit) instead of duplicating
   CI/publish mechanics.

## Creating a new plugin from this template

1. Use this repo as a template (GitHub "Use this template" button).
2. Replace `my-plugin` in `plugin/.plugin.json` with your plugin's slug.
3. Replace the placeholder functions and auth provider with your own.
4. Import types from `@orgsdk/plugins`; import `z` from `zod` for config schemas.
5. Run `bun run build` to typecheck, validate, and package.
6. Configure the catalog publish settings (see [release.md](release.md)).

See the [OrgSDK/plugins README](https://github.com/OrgSDK/plugins#readme) for
the full authoring API surface.

## Upgrading the contract version

The dependency is pinned exactly (`0.2.0`). When a new contract version is
released, update the version in `package.json`, regenerate the lockfile with
`bun install`, and confirm tests still pass. Prefer deliberate, reviewed
upgrades over floating ranges while the contract is still pre-1.0.
