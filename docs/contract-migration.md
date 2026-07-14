# Contract migration plan

## Current state

This repository ships a **temporary type-only shim** at
`plugin/contract.ts` that mirrors the public plugin authoring types
re-exported by `orgsdk/plugins` in the main OrgSDK monorepo.

The shim exists so that this plugin can be developed, typechecked, and tested
as a standalone package **without** a runtime or build-time dependency on
private daemon/platform packages (`@orgsdk/daemon`, `@orgsdk/storage`,
`@orgsdk/shared`, etc.).

Every export in `plugin/contract.ts` is a TypeScript type — no runtime values.
At daemon load time the real `PluginContext` (stores, logger, base URL) is
injected via the factory function; the shim is erased at compile time.

## Why a local shim instead of a package?

The planned **`@orgsdk/plugin-contract`** types-only npm package does not
exist yet. Rather than block external plugin development on its publication,
we ship a minimal, documented, faithful copy of the authoring surface that
can be replaced mechanically when the real package lands.

## What's in the shim

Exactly the public authoring surface — nothing internal:

- Store interfaces (`CredentialStore`, `ConfigStore`) — structural, matching
  `@orgsdk/storage`.
- `PluginLogger` — a structural logger type (avoids a hard `pino` dependency).
- `PluginContext`, `PluginModule`, `PluginFactory`.
- `AuthProvider`, `AuthMeta`, `HttpEndpoint`.
- `SafeFunction` and its metadata/docs types.
- `PluginConfigDefinition`, `PluginManifest`, `PluginTableSchema`.

No daemon internals, no sandbox types, no store implementations, no schema
table definitions.

## Migration when @orgsdk/plugin-contract ships

1. `bun add @orgsdk/plugin-contract` (types-only — `devDependencies`).
2. Search-replace `from "./contract"` → `from "@orgsdk/plugin-contract"`
   across `plugin/**/*.ts`.
3. Delete `plugin/contract.ts`.
4. Update `tests/purity.test.ts` to allow the new specifier.
5. Update `scripts/validate-plugin.ts` to allow `@orgsdk/plugin-contract`
   (it's type-only, like the current shim).
6. `bun run build` — should pass with zero source changes beyond the import
   path.

## Provenance

| Field | Value |
|---|---|
| Sourced from | `packages/daemon/src/plugins/{module-types,types}.ts` |
| Storage interfaces from | `packages/storage/src/interfaces/{credential,config}-store.ts` |
