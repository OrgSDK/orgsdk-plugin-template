#!/usr/bin/env bun
/**
 * package-plugin.ts — deterministically stage the plugin folder into a
 * distributable artifact.
 *
 * Steps:
 *   1. Remove dist/ entirely (node:fs rm, not shell) — no stale files survive.
 *   2. Copy plugin/ → dist/<slug>/ (sorted traversal for determinism).
 *   3. Generate a minimal package.json in dist/<slug>/ carrying the plugin's
 *      runtime dependencies — the catalog's readPluginFolder reads this to
 *      resolve deps at materialise time.
 *   4. Write a checksum manifest (sorted entries).
 *   5. Produce a tarball (sorted file order).
 *
 * No network calls, no catalog publishing — purely local staging.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { $ } from "bun";

const ROOT = resolve(import.meta.dir, "..");
const PLUGIN_DIR = join(ROOT, "plugin");
const DIST_DIR = join(ROOT, "dist");

interface FileEntry {
	path: string;
	size: number;
	sha256: string;
}

async function readManifest(): Promise<{ name: string; version: string }> {
	const raw = await readFile(join(PLUGIN_DIR, ".plugin.json"), "utf-8");
	return JSON.parse(raw) as { name: string; version: string };
}

async function readRootPkg(): Promise<{
	name: string;
	type?: string;
	dependencies?: Record<string, string>;
}> {
	const raw = await readFile(join(ROOT, "package.json"), "utf-8");
	return JSON.parse(raw) as {
		name: string;
		type?: string;
		dependencies?: Record<string, string>;
	};
}

/** Recursively collect files, sorted by relative path for determinism. */
async function collectFiles(dir: string): Promise<string[]> {
	const out: string[] = [];
	async function walk(d: string) {
		const entries = await readdir(d, { withFileTypes: true });
		entries.sort((a, b) => a.name.localeCompare(b.name));
		for (const entry of entries) {
			const abs = join(d, entry.name);
			if (entry.isDirectory()) {
				await walk(abs);
			} else if (entry.isFile()) {
				out.push(abs);
			}
		}
	}
	await walk(dir);
	return out;
}

async function main(): Promise<void> {
	const manifest = await readManifest();
	const slug = manifest.name;
	const version = manifest.version;
	const rootPkg = await readRootPkg();

	// Deterministic clean: remove dist/ entirely, then recreate from scratch.
	// Deleted source files cannot survive into a later artifact.
	await rm(DIST_DIR, { recursive: true, force: true });
	await mkdir(DIST_DIR, { recursive: true });

	const stagedDir = join(DIST_DIR, slug);
	await mkdir(stagedDir, { recursive: true });

	// Stage plugin source files (sorted traversal).
	const sourceFiles = await collectFiles(PLUGIN_DIR);
	const entries: FileEntry[] = [];

	for (const abs of sourceFiles) {
		const relPath = abs.slice(PLUGIN_DIR.length + 1);
		const dest = join(stagedDir, relPath);
		await mkdir(resolve(dest, ".."), { recursive: true });
		const content = await readFile(abs);
		await writeFile(dest, content);
		entries.push({
			path: relPath,
			size: content.length,
			sha256: createHash("sha256").update(content).digest("hex"),
		});
	}

	// Generate minimal package.json for the staged plugin folder.
	// The catalog's readPluginFolder reads dependencies from <plugin>/package.json
	// to resolve runtime deps at materialise time (resolvePluginDeps).
	// Include only production deps — no devDependencies, no scripts, no private.
	const pluginPkg: Record<string, unknown> = {
		name: rootPkg.name,
		version,
		type: rootPkg.type ?? "module",
	};
	if (rootPkg.dependencies && Object.keys(rootPkg.dependencies).length > 0) {
		pluginPkg.dependencies = rootPkg.dependencies;
	}
	const pluginPkgJson = `${JSON.stringify(pluginPkg, null, "\t")}\n`;
	await writeFile(join(stagedDir, "package.json"), pluginPkgJson);
	entries.push({
		path: "package.json",
		size: pluginPkgJson.length,
		sha256: createHash("sha256").update(pluginPkgJson).digest("hex"),
	});

	// Sort entries by path for deterministic manifest output.
	entries.sort((a, b) => a.path.localeCompare(b.path));

	// Write checksum manifest.
	const checksumPath = join(DIST_DIR, `${slug}-${version}.manifest.json`);
	const manifestJson = `${JSON.stringify(
		{ slug, version, fileCount: entries.length, files: entries },
		null,
		"\t",
	)}\n`;
	await writeFile(checksumPath, manifestJson);

	// Create tarball using sorted file list for reproducible archive order.
	const tarball = join(DIST_DIR, `${slug}-${version}.tgz`);
	const fileList = entries.map((e) => e.path);
	await $`tar -czf ${tarball} -C ${stagedDir} ${fileList}`.quiet();

	console.log(`✓ Cleaned and recreated dist/`);
	console.log(`✓ Staged ${entries.length} files → dist/${slug}/`);
	console.log(`✓ Generated dist/${slug}/package.json (runtime deps)`);
	console.log(`✓ Manifest → dist/${slug}-${version}.manifest.json`);
	console.log(`✓ Tarball  → dist/${slug}-${version}.tgz`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
