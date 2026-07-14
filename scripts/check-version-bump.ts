#!/usr/bin/env bun
/**
 * check-version-bump.ts — CI guard for write-once catalog versions.
 *
 * Two checks:
 *
 * 1. Version-sync invariant (always): the root package.json `version` must
 *    equal the manifest `version` (plugin/.plugin.json). They are the same
 *    logical release; drift silently splits the published version from the
 *    repo's recorded version.
 *
 * 2. Content-bump gate (needs a git base): if publishable artifact content
 *    changed relative to BASE_REF, the manifest `version` must also change.
 *    Publishable content = everything staged into dist/<slug>/:
 *      - plugin/**            (the shipped plugin source)
 *      - package.json         (only if name/type/dependencies changed —
 *                              these feed the generated artifact package.json)
 *    Docs, tests, workflows, README, scripts, and devDependency-only
 *    package.json edits do NOT require a bump.
 *
 * Exit 0 = ok (or no base available, so the content gate is skipped after the
 * sync invariant passes). Exit 1 = violation.
 *
 * Env:
 *   BASE_REF — git ref or SHA to diff against (CI sets this per event).
 *              Without it, only the sync invariant runs.
 */
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { $ } from "bun";

const ROOT = resolve(import.meta.dir, "..");
const PLUGIN_DIR = join(ROOT, "plugin");
const MANIFEST_PATH = join(PLUGIN_DIR, ".plugin.json");
const PKG_PATH = join(ROOT, "package.json");

interface Versioned {
	version: string;
}

interface RootPkg {
	name?: string;
	type?: string;
	dependencies?: Record<string, string>;
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, "utf-8")) as T;
}

function isZeroSha(ref: string): boolean {
	return /^0+$/.test(ref);
}

async function gitOk(args: string[]): Promise<boolean> {
	const r = Bun.spawnSync(["git", ...args], { cwd: ROOT });
	return r.exitCode === 0;
}

async function gitText(args: string[]): Promise<string> {
	return $`git ${args}`
		.cwd(ROOT)
		.quiet()
		.text()
		.then((t) => t.trim());
}

async function resolveBase(): Promise<string | undefined> {
	const ref = (process.env.BASE_REF ?? "").trim();
	if (!ref || isZeroSha(ref)) return undefined;
	if (!(await gitOk(["cat-file", "-e", `${ref}^{commit}`]))) return undefined;
	return ref;
}

/** Files changed on HEAD since its merge-base with base (three-dot semantics). */
async function changedFiles(base: string): Promise<string[]> {
	const mb = await gitText(["merge-base", base, "HEAD"]);
	const text = await $`git diff --name-only ${mb} HEAD`
		.cwd(ROOT)
		.quiet()
		.text();
	return text
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
}

async function showBaseJson(
	base: string,
	relPath: string,
): Promise<unknown | undefined> {
	const r = Bun.spawnSync(["git", "show", `${base}:${relPath}`], {
		cwd: ROOT,
	});
	if (r.exitCode !== 0) return undefined;
	try {
		return JSON.parse(r.stdout.toString()) as unknown;
	} catch {
		return undefined;
	}
}

/** Whether a package.json diff affects the generated artifact package.json. */
function artifactPkgChanged(
	basePkg: RootPkg | undefined,
	headPkg: RootPkg | undefined,
): boolean {
	const norm = (p: RootPkg | undefined) => ({
		name: p?.name ?? "",
		type: p?.type ?? "",
		dependencies: p?.dependencies ?? {},
	});
	return JSON.stringify(norm(basePkg)) !== JSON.stringify(norm(headPkg));
}

async function main(): Promise<void> {
	const manifest = await readJson<Versioned>(MANIFEST_PATH);
	const pkg = await readJson<RootPkg & Versioned>(PKG_PATH);

	// ── 1. Version-sync invariant ──────────────────────────────────────────
	if (manifest.version !== pkg.version) {
		console.error(
			`✗ version-sync: package.json (${pkg.version}) != manifest (${manifest.version}).`,
		);
		console.error("  Bump both together — they record the same release.");
		process.exit(1);
	}

	// ── 2. Content-bump gate ───────────────────────────────────────────────
	const base = await resolveBase();
	if (!base) {
		console.log(
			`✓ version-sync ok (${manifest.version}). No BASE_REF — content-bump gate skipped.`,
		);
		return;
	}

	const changed = await changedFiles(base);
	const pluginChanged = changed.some((f) => f.startsWith("plugin/"));
	const pkgChanged = changed.includes("package.json");

	let requiresBump = pluginChanged;
	let reason = pluginChanged ? "plugin/** changed" : "";

	if (pkgChanged) {
		const basePkg = (await showBaseJson(base, "package.json")) as
			| RootPkg
			| undefined;
		if (artifactPkgChanged(basePkg, pkg)) {
			requiresBump = true;
			reason = reason
				? `${reason}; package.json name/type/dependencies changed`
				: "package.json name/type/dependencies changed";
		}
	}

	if (!requiresBump) {
		console.log(
			`✓ version-sync ok (${manifest.version}). No publishable content changed (${changed.length} file(s) touched).`,
		);
		return;
	}

	const baseManifest = (await showBaseJson(base, "plugin/.plugin.json")) as
		| Versioned
		| undefined;
	const baseVersion = baseManifest?.version ?? "";

	if (manifest.version === baseVersion) {
		console.error("✗ version-bump required: publishable content changed but");
		console.error(`  manifest version is unchanged at ${manifest.version}.`);
		console.error(`  Reason: ${reason}.`);
		console.error("  Bump plugin/.plugin.json version (and package.json).");
		process.exit(1);
	}

	console.log(
		`✓ version-sync ok; content changed (${reason}) → version bumped ${baseVersion || "∅"} → ${manifest.version}.`,
	);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
