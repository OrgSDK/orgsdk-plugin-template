/**
 * Packaging tests — determinism, stale-output removal, and generated
 * package.json in the staged artifact.
 */

import { describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { $ } from "bun";

const ROOT = resolve(import.meta.dir, "..");
const DIST_DIR = join(ROOT, "dist");

interface ManifestInfo {
	name: string;
	version: string;
}

async function readManifestInfo(): Promise<ManifestInfo> {
	const raw = await readFile(join(ROOT, "plugin", ".plugin.json"), "utf-8");
	return JSON.parse(raw) as ManifestInfo;
}

async function manifestPath(): Promise<string> {
	const { name, version } = await readManifestInfo();
	return join(DIST_DIR, `${name}-${version}.manifest.json`);
}

describe("packaging", () => {
	it("removes stale files from dist/ before staging", async () => {
		await rm(DIST_DIR, { recursive: true, force: true });
		await mkdir(DIST_DIR, { recursive: true });
		const sentinel = join(DIST_DIR, "STALE_SENTINEL.txt");
		await writeFile(sentinel, "this should not survive packaging");

		await $`bun run scripts/package-plugin.ts`.cwd(ROOT).quiet();

		await expect(stat(sentinel)).rejects.toThrow();
	});

	it("produces deterministic output across runs", async () => {
		await $`bun run scripts/package-plugin.ts`.cwd(ROOT).quiet();
		const first = await readFile(await manifestPath(), "utf-8");

		await $`bun run scripts/package-plugin.ts`.cwd(ROOT).quiet();
		const second = await readFile(await manifestPath(), "utf-8");

		expect(second).toBe(first);
	});

	it("manifest entries are sorted by path", async () => {
		await $`bun run scripts/package-plugin.ts`.cwd(ROOT).quiet();
		const raw = await readFile(await manifestPath(), "utf-8");
		const parsed = JSON.parse(raw) as {
			files: Array<{ path: string }>;
		};
		const paths = parsed.files.map((f) => f.path);
		const sorted = [...paths].sort((a, b) => a.localeCompare(b));
		expect(paths).toEqual(sorted);
	});

	it("generated package.json in artifact has runtime deps only", async () => {
		const { name } = await readManifestInfo();
		await $`bun run scripts/package-plugin.ts`.cwd(ROOT).quiet();
		const pkgPath = join(DIST_DIR, name, "package.json");
		const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<
			string,
			unknown
		>;

		expect(typeof pkg.name).toBe("string");
		expect(typeof pkg.version).toBe("string");
		expect(pkg.type).toBe("module");
		expect(pkg.dependencies).toBeDefined();
		expect(pkg.devDependencies).toBeUndefined();
		expect(pkg.scripts).toBeUndefined();
		expect(pkg.private).toBeUndefined();
	});

	it("manifest includes the generated package.json entry", async () => {
		await $`bun run scripts/package-plugin.ts`.cwd(ROOT).quiet();
		const raw = await readFile(await manifestPath(), "utf-8");
		const parsed = JSON.parse(raw) as {
			files: Array<{ path: string }>;
		};
		const paths = parsed.files.map((f) => f.path);
		expect(paths).toContain("package.json");
	});
});
