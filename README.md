# @orgsdk/plugin-template

GitHub template repository for official OrgSDK plugins. Use this to bootstrap
a new plugin with the correct structure, tooling, and CI.

[![CI](https://github.com/OrgSDK/orgsdk-plugin-template/actions/workflows/ci.yml/badge.svg)](https://github.com/OrgSDK/orgsdk-plugin-template/actions/workflows/ci.yml)

## How to use this template

1. Click **"Use this template"** → **"Create a new repository"** on GitHub,
   or clone and reset history:

   ```bash
   git clone --depth 1 https://github.com/OrgSDK/orgsdk-plugin-template.git orgsdk-plugin-<your-plugin>
   cd orgsdk-plugin-<your-plugin>
   rm -rf .git
   git init
   ```

2. Search-replace these placeholders across the repo:

   | Placeholder | Where | Replace with |
   |---|---|---|
   | `my-plugin` | `plugin/.plugin.json` (`name`, `marketplace.displayName`) | your slug |
   | `my-service` | `plugin/.plugin.json`, `plugin/auth-provider.ts`, `plugin/functions.ts` | your credential provider key |
   | `My Plugin` / `My Service` | manifest, README, docs | your plugin name |
   | `@orgsdk/plugin-template` | `package.json` | `@orgsdk/plugin-<slug>` |

3. Replace the placeholder code:
   - `plugin/functions.ts` — your safe functions.
   - `plugin/auth-provider.ts` — your auth flow (token or OAuth2).
   - `plugin/index.ts` — your config schema and `onLoad` hook.
   - `plugin/.plugin.json` — manifest fields, marketplace metadata.
   - `plugin/docs/overview.md` — user-facing docs.

4. Install, validate, and run:

   ```bash
   bun install
   bun run build   # typecheck + validate + package
   ```

5. Push to GitHub — CI runs automatically.

## Repository layout

```
orgsdk-plugin-template/
├── .github/workflows/
│   ├── ci.yml                 # CI: install, lint, typecheck, test, validate, package, version guard
│   └── publish-catalog.yml    # auto-publish to catalog on main (opt-in); manual dry-run
├── plugin/                    # the publishable plugin folder
│   ├── .plugin.json           # manifest (slug, version, auth, marketplace)
│   ├── index.ts               # entry — factory(ctx) → PluginModule
│   ├── auth-provider.ts       # token auth provider (placeholder)
│   ├── functions.ts           # safe functions (placeholder)
│   └── docs/overview.md       # plugin-local docs
├── tests/                     # bun:test — manifest, source purity, plugin shape
├── scripts/                   # validate-plugin, package-plugin, publish-catalog, check-version-bump
├── docs/                      # contract migration, release/promotion contract
├── package.json
├── tsconfig.json
├── biome.json
└── README.md
```

## Local development

Requires [Bun](https://bun.sh) ≥ 1.3.x.

```bash
bun install          # install dependencies
bun run check        # biome lint + format check
bun run typecheck    # tsc --noEmit
bun run test         # bun test
bun run validate     # manifest + source purity validation
bun run package      # stage artifact into dist/
bun run build        # full pipeline: typecheck → validate → package
```

## Manifest & version rules

- The manifest lives at `plugin/.plugin.json`.
- `version` is the **source of truth** for the catalog — bump it on every
  publishable content change (the CI version guard enforces this).
- `package.json` → `version` is kept in sync with the manifest (enforced by
  the version guard).
- Versions are **write-once** in the catalog: re-publishing the same
  `(slug, version)` with identical content is idempotent; differing content is
  rejected (HTTP 409). Treat every publish as forward-only.
- See [docs/release.md](docs/release.md) for the automatic publish model and
  the repository settings a new plugin must configure.

## Security constraints

- Credentials are injected at call time via `requiredCredentials` — they are
  **never** hardcoded, logged, or persisted in plugin source.
- Source purity is enforced: no imports from private `@orgsdk/*` packages,
  no cross-plugin imports, no runtime value imports from the authoring SDK.
- Publish credentials (`ORGSDK_PUBLISH_TOKEN`) live as a GitHub secret
  (repository-level or `catalog-publish` environment); they are never committed
  to the repo. This template contains no real credentials or endpoints.

## Authoring contract

The plugin authoring types come from the public
[`@orgsdk/plugins`](https://www.npmjs.com/package/@orgsdk/plugins) npm package,
imported type-only (`import type { … } from "@orgsdk/plugins"`). The SDK is a
dev-only dependency; the runtime artifact carries only `zod`. See
[docs/contract-migration.md](docs/contract-migration.md).

## License

Proprietary — All rights reserved. This source is the confidential property
of OrgSDK. No part of this repository may be reproduced, distributed, or
transmitted in any form without the prior written permission of OrgSDK.
Unauthorized use, modification, or redistribution is strictly prohibited.
