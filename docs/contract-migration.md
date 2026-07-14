# Contract migration — completed

## Status: migrated to `@orgsdk/plugins`

This template now imports its authoring types from the public
[`@orgsdk/plugins`](https://github.com/OrgSDK/plugins) package instead of a
local shim. New plugins created from this template start with the right
contract from day one.

## What changed

1. **`plugin/contract.ts` deleted** — no local shim needed.
2. **All imports** use `import type { … } from "@orgsdk/plugins"`.
3. **devDependency pinned** to the public GitHub repo at an immutable commit
   (`github:OrgSDK/plugins#da5ae72…`) until npm publication of v0.1.0.
4. **Purity guards** allow `@orgsdk/plugins` type-only imports; value imports
   and all other `@orgsdk/*` packages are blocked.
5. **Artifact purity** — the runtime artifact carries `zod` but NOT
   `@orgsdk/plugins` (type-only imports are erased at compile time).

## Creating a new plugin from this template

1. Use this repo as a template (GitHub "Use this template" button).
2. Replace `my-plugin` in `plugin/.plugin.json` with your plugin's slug.
3. Replace the placeholder functions and auth provider with your own.
4. Import types from `@orgsdk/plugins`; import `z` from `zod` for config schemas.
5. Run `bun run build` to typecheck, validate, and package.

See the [OrgSDK/plugins README](https://github.com/OrgSDK/plugins#readme) for
the full authoring API surface.
