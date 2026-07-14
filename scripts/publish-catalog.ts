#!/usr/bin/env bun
/**
 * publish-catalog.ts — package the validated plugin artifact and POST it to
 * the OrgSDK platform catalog API (POST /api/plugins).
 *
 * The route expects an admin-authenticated JSON body:
 *   { slug, name, description?, version, category?, visibility: "public",
 *     files: [{ path, content }] }
 *
 * Auth: a Bearer token (admin JWT) passed via --token or ORGSDK_PUBLISH_TOKEN.
 * URL: the platform base URL via --url or ORGSDK_CATALOG_URL (non-secret).
 *
 * Default mode is --dry-run (packages + prints the payload, does NOT POST).
 * A real publish requires --publish AND a valid token.
 *
 * Write-once safety: if the catalog rejects because the version already
 * exists with different content, the script reports the error clearly and
 * exits non-zero. It never overwrites an existing same-version artifact.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { $ } from "bun";

const ROOT = resolve(import.meta.dir, "..");
const DIST_DIR = join(ROOT, "dist");

interface Args {
	url: string;
	token: string | undefined;
	dryRun: boolean;
}

function parseArgs(): Args {
	const argv = process.argv.slice(2);
	const get = (name: string): string | undefined => {
		const i = argv.indexOf(`--${name}`);
		return i >= 0 ? argv[i + 1] : undefined;
	};
	const url = (get("url") ?? process.env.ORGSDK_CATALOG_URL ?? "").replace(
		/\/$/,
		"",
	);
	const token = get("token") ?? process.env.ORGSDK_PUBLISH_TOKEN;
	const dryRun = !argv.includes("--publish");
	if (!url) {
		console.error(
			"Catalog URL required: pass --url <url> or set ORGSDK_CATALOG_URL",
		);
		process.exit(1);
	}
	if (!dryRun && !token) {
		console.error(
			"Publish requires auth: pass --token <jwt> or set ORGSDK_PUBLISH_TOKEN",
		);
		process.exit(1);
	}
	return { url, token, dryRun };
}

async function readManifest(): Promise<{
	name: string;
	version: string;
	description: string;
}> {
	const raw = await readFile(join(ROOT, "plugin", ".plugin.json"), "utf-8");
	return JSON.parse(raw) as {
		name: string;
		version: string;
		description: string;
	};
}

async function collectFiles(
	dir: string,
	base: string,
): Promise<Array<{ path: string; content: string }>> {
	const out: Array<{ path: string; content: string }> = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...(await collectFiles(abs, base)));
		} else if (entry.isFile()) {
			const rel = abs.slice(base.length + 1);
			const content = await readFile(abs, "utf-8");
			out.push({ path: rel, content });
		}
	}
	return out;
}

async function main(): Promise<void> {
	const args = parseArgs();

	// Package the artifact first (deterministic staging).
	await $`bun run scripts/package-plugin.ts`.cwd(ROOT).quiet();

	const manifest = await readManifest();
	const slug = manifest.name;
	const version = manifest.version;
	const stagedDir = join(DIST_DIR, slug);
	const files = await collectFiles(stagedDir, stagedDir);

	const payload = {
		slug,
		name: slug,
		description: manifest.description,
		version,
		category: slug,
		visibility: "public" as const,
		files,
	};

	console.log(`  ${slug} v${version} — ${files.length} files staged`);
	console.log(`  Target: ${args.url}/api/plugins`);

	if (args.dryRun) {
		console.log("\n--dry-run (or no --publish flag): not posting to catalog.");
		console.log(
			`  To publish: add --publish and ensure ORGSDK_PUBLISH_TOKEN is set.`,
		);
		return;
	}

	const resp = await fetch(`${args.url}/api/plugins`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${args.token}`,
		},
		body: JSON.stringify(payload),
	});

	const text = await resp.text();
	if (!resp.ok) {
		console.error(`Publish failed (${resp.status}): ${text}`);
		console.error(
			`\nIf the version already exists with different content, bump the version in plugin/.plugin.json.`,
		);
		process.exit(1);
	}

	console.log(`Published: ${text}`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
