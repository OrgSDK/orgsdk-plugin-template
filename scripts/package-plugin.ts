#!/usr/bin/env bun
/**
 * package-plugin.ts — stage the plugin folder into a distributable artifact.
 *
 * Copies `plugin/` → `dist/<slug>/`, writes a checksum manifest, and produces
 * a tarball suitable for catalog promotion (future step). No network calls,
 * no catalog publishing — purely local staging.
 *
 * The resulting `dist/` directory is uploaded as a CI artifact.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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
	const parsed = JSON.parse(raw) as { name: string; version: string };
	return parsed;
}

async function collectFiles(dir: string): Promise<string[]> {
	const out: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...(await collectFiles(abs)));
		} else if (entry.isFile()) {
			out.push(abs);
		}
	}
	return out;
}

async function main(): Promise<void> {
	const manifest = await readManifest();
	const slug = manifest.name;
	const version = manifest.version;

	// Clean + create dist
	await mkdir(DIST_DIR, { recursive: true });
	const stagedDir = join(DIST_DIR, slug);

	// Stage plugin files
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

	// Write checksum manifest
	const checksumPath = join(DIST_DIR, `${slug}-${version}.manifest.json`);
	await writeFile(
		checksumPath,
		`${JSON.stringify(
			{ slug, version, fileCount: entries.length, files: entries },
			null,
			2,
		)}\n`,
	);

	// Create tarball
	const tarball = join(DIST_DIR, `${slug}-${version}.tgz`);
	await $`tar -czf ${tarball} -C ${DIST_DIR} ${slug}`.quiet();

	console.log(`✓ Staged ${entries.length} files → dist/${slug}/`);
	console.log(`✓ Manifest → dist/${slug}-${version}.manifest.json`);
	console.log(`✓ Tarball  → dist/${slug}-${version}.tgz`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
