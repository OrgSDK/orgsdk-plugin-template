/**
 * Plugin shape / contract tests.
 *
 * Imports the real entry through Bun's module system (no daemon, no DB) and
 * exercises the factory with a no-op PluginContext.
 */
import { describe, expect, it } from "bun:test";
import type {
	AuthProvider,
	PluginContext,
	PluginModule,
} from "@orgsdk/plugins";

const noopCtx: PluginContext = {
	stores: {
		credential: {
			get: async () => null,
			list: async () => [],
			upsert: async () => {},
			delete: async () => {},
			getSecrets: async () => null,
			setSecrets: async () => {},
		},
		config: {
			list: async () => [],
			get: async () => null,
			set: async () => ({ key: "", value: {}, updatedAt: null }),
			delete: async () => {},
		},
	},
	publicBaseUrl: "http://localhost:3000",
	logger: {
		trace() {},
		debug() {},
		info() {},
		warn() {},
		error() {},
		fatal() {},
		child() {
			return this;
		},
	},
};

async function loadPlugin(): Promise<PluginModule> {
	const mod = await import("../plugin/index");
	const factory = mod.default as (ctx: PluginContext) => PluginModule;
	return factory(noopCtx);
}

describe("plugin shape", () => {
	it("factory returns a module with safeFunctions", async () => {
		const mod = await loadPlugin();
		expect(Array.isArray(mod.safeFunctions)).toBe(true);
		expect(mod.safeFunctions?.length).toBeGreaterThan(0);
	});

	it("every function has a name and handler", async () => {
		const mod = await loadPlugin();
		const fns = mod.safeFunctions ?? [];
		for (const fn of fns) {
			expect(typeof fn.name).toBe("string");
			expect(typeof fn.handler).toBe("function");
		}
	});

	it("has an authProvider", async () => {
		const mod = await loadPlugin();
		const auth = mod.authProvider as AuthProvider | undefined;
		expect(auth).toBeDefined();
		expect(["token", "oauth2"]).toContain(auth?.type as string);
	});

	it("has a Zod config schema", async () => {
		const mod = await loadPlugin();
		expect(mod.config).toBeDefined();
		expect(mod.config?.schema).toBeDefined();
	});
});
