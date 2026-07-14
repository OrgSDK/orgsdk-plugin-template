import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const MANIFEST_PATH = resolve(import.meta.dir, "..", "plugin", ".plugin.json");

async function readManifest() {
	const raw = await readFile(MANIFEST_PATH, "utf-8");
	return JSON.parse(raw) as Record<string, unknown>;
}

describe("manifest", () => {
	it("has a non-empty name (slug)", async () => {
		const m = await readManifest();
		expect(typeof m.name).toBe("string");
		expect((m.name as string).length).toBeGreaterThan(0);
	});

	it("has a semver version", async () => {
		const m = await readManifest();
		expect(m.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("has a non-empty description", async () => {
		const m = await readManifest();
		expect(typeof m.description).toBe("string");
		expect((m.description as string).length).toBeGreaterThan(0);
	});

	it("declares entry as index.ts", async () => {
		const m = await readManifest();
		expect(m.entry).toBe("index.ts");
	});

	it("declares auth with a type and provider", async () => {
		const m = await readManifest();
		const auth = m.auth as Record<string, unknown>;
		expect(["token", "oauth2"]).toContain(auth.type as string);
		expect(typeof auth.provider).toBe("string");
		expect((auth.provider as string).length).toBeGreaterThan(0);
	});
});
