#!/usr/bin/env bun
/**
 * validate-plugin.ts — manifest + source purity validation.
 *
 * Runs as part of `bun run validate` (also in CI). Checks:
 *   1. plugin/.plugin.json exists and has required fields
 *   2. Entry file referenced by manifest exists
 *   3. No forbidden imports in plugin source (private @orgsdk/*, cross-plugin)
 *   4. @orgsdk/plugins is imported type-only (it is a dev-only authoring SDK)
 *
 * Exit code 0 = clean, 1 = violations found.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const PLUGIN_DIR = resolve(import.meta.dir, "..", "plugin");

interface Violation {
	file: string;
	rule: string;
	detail: string;
}

const violations: Violation[] = [];

function rel(abs: string): string {
	return relative(resolve(import.meta.dir, ".."), abs);
}

// ─── 1. Manifest ─────────────────────────────────────────────────────────

async function readManifest(): Promise<Record<string, unknown>> {
	const manifestPath = join(PLUGIN_DIR, ".plugin.json");
	const raw = await readFile(manifestPath, "utf-8");
	return JSON.parse(raw) as Record<string, unknown>;
}

function validateManifest(manifest: Record<string, unknown>): void {
	const required = ["name", "version", "description", "entry"];
	for (const field of required) {
		const value = manifest[field];
		if (typeof value !== "string" || value.length === 0) {
			violations.push({
				file: "plugin/.plugin.json",
				rule: "manifest-required",
				detail: `Missing or empty required field "${field}"`,
			});
		}
	}

	const auth = manifest.auth as Record<string, unknown> | undefined;
	if (auth) {
		if (auth.type !== "token" && auth.type !== "oauth2") {
			violations.push({
				file: "plugin/.plugin.json",
				rule: "manifest-auth-type",
				detail: `auth.type must be "token" or "oauth2", got "${String(auth.type)}"`,
			});
		}
		if (typeof auth.provider !== "string" || !auth.provider) {
			violations.push({
				file: "plugin/.plugin.json",
				rule: "manifest-auth-provider",
				detail: "auth.provider must be a non-empty string",
			});
		}
	}
}

// ─── 2. Entry exists ─────────────────────────────────────────────────────

async function validateEntry(manifest: Record<string, unknown>): Promise<void> {
	const entry = manifest.entry as string | undefined;
	if (!entry) return;
	const entryPath = join(PLUGIN_DIR, entry);
	try {
		const s = await stat(entryPath);
		if (!s.isFile()) {
			violations.push({
				file: rel(entryPath),
				rule: "entry-not-file",
				detail: `Manifest entry "${entry}" is not a regular file`,
			});
		}
	} catch {
		violations.push({
			file: rel(entryPath),
			rule: "entry-missing",
			detail: `Manifest entry "${entry}" does not exist`,
		});
	}
}

// ─── 3+4. Source purity ──────────────────────────────────────────────────

/** Matches `@orgsdk/<pkg>` or bare `orgsdk/<subpath>` import specifiers. */
const FORBIDDEN_SPECIFIERS =
	/(?:^|\n)\s*import\b[^;]*?from\s+["']((?:@orgsdk\/|orgsdk\/)[^"']+)["']/g;

/** Matches value (non-type) imports from @orgsdk/plugins — forbidden at runtime. */
const SDK_VALUE_IMPORT =
	/(?:^|\n)\s*import\s+(?!type\b)\{[^}]*\}\s+from\s+["']@orgsdk\/plugins["']/;

async function collectTsFiles(dir: string): Promise<string[]> {
	const out: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...(await collectTsFiles(abs)));
		} else if (entry.isFile() && entry.name.endsWith(".ts")) {
			out.push(abs);
		}
	}
	return out;
}

async function validateSourcePurity(): Promise<void> {
	const files = await collectTsFiles(PLUGIN_DIR);
	for (const file of files) {
		const src = await readFile(file, "utf-8");

		for (const match of src.matchAll(FORBIDDEN_SPECIFIERS)) {
			const spec = match[1];
			if (spec === "@orgsdk/plugins" || spec.startsWith("@orgsdk/plugins/")) {
				continue;
			}
			violations.push({
				file: rel(file),
				rule: "forbidden-import",
				detail: `Import of internal package "${spec}" — external plugins must not depend on private OrgSDK packages`,
			});
		}

		if (SDK_VALUE_IMPORT.test(src)) {
			violations.push({
				file: rel(file),
				rule: "sdk-value-import",
				detail:
					"Value import from @orgsdk/plugins — use `import type` only (the SDK is dev-only and must not be a runtime dependency)",
			});
		}
	}
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const manifest = await readManifest();
	validateManifest(manifest);
	await validateEntry(manifest);
	await validateSourcePurity();

	if (violations.length > 0) {
		console.error(`\n✗ ${violations.length} validation violation(s):\n`);
		for (const v of violations) {
			console.error(`  [${v.rule}] ${v.file}`);
			console.error(`    ${v.detail}\n`);
		}
		process.exit(1);
	}

	console.log(
		`✓ Plugin "${String(manifest.name)}" v${String(manifest.version)} — manifest + source purity validated.`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
