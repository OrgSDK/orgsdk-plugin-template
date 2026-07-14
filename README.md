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
├── .github/workflows/ci.yml      # CI: install, lint, typecheck, test, validate, package
├── plugin/                       # the publishable plugin folder
│   ├── .plugin.json              # manifest (slug, version, auth, marketplace)
│   ├── contract.ts               # temporary type-only authoring shim
│   ├── index.ts                  # entry — factory(ctx) → PluginModule
│   ├── auth-provider.ts          # token auth provider (placeholder)
│   ├── functions.ts              # safe functions (placeholder)
│   └── docs/overview.md          # plugin-local docs
├── tests/                        # bun:test — manifest, source purity, plugin shape
├── scripts/                      # validate-plugin.ts, package-plugin.ts
├── docs/                         # contract migration plan, release/promotion contract
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
  behavior change.
- Versions are **write-once** in the catalog history table.
- There is no rollback path yet — treat every publish as forward-only.
- See [docs/release.md](docs/release.md) for the catalog promotion contract.

## Security constraints

- Credentials are injected at call time via `requiredCredentials` — they are
  **never** hardcoded, logged, or persisted in plugin source.
- Source purity is enforced: no imports from private `@orgsdk/*` packages,
  no cross-plugin imports, no runtime value imports from the type shim.
- No publish credentials or production catalog secrets exist in this repo.

## Contract shim

The plugin authoring types live in `plugin/contract.ts` as a temporary,
type-only shim. See [docs/contract-migration.md](docs/contract-migration.md).

## License

MIT
