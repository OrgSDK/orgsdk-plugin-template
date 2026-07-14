/**
 * Temporary OrgSDK plugin authoring contract — type-only shim.
 *
 * This file mirrors the public plugin authoring types re-exported by
 * `orgsdk/plugins` in the main OrgSDK monorepo so that this plugin can be
 * authored, typechecked, and tested as a standalone package without a runtime
 * dependency on private daemon/platform packages.
 *
 * Every export below is a TypeScript type (erased at compile time). No runtime
 * values are exported. The daemon injects real store/logger instances at load
 * time via `PluginFactory(ctx)`.
 *
 * TODO(contract-package): Replace this local shim with the planned
 * `@orgsdk/plugin-contract` types-only npm package once published. The
 * migration is a search-and-replace of `./contract` → `@orgsdk/plugin-contract`
 * across this plugin's source files. See docs/contract-migration.md.
 *
 * @source packages/daemon/src/plugins/{module-types,types}.ts
 * @source packages/storage/src/interfaces/{credential,config}-store.ts
 */

// ─── Zod ─────────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: mirrors monorepo AnyZodLikeSchema — any is deliberate to avoid Zod version coupling
export type AnyZodLikeSchema = import("zod").ZodType<any, any, any>;

// ─── Store interfaces (structural — match @orgsdk/storage) ────────────────

export type CredentialSecretBundle = Record<string, unknown>;

export interface CredentialMetadata {
	provider: string;
	name: string;
	label?: string;
	valid?: boolean;
	scopes?: string[];
	source?: string;
	createdAt?: Date;
	updatedAt?: Date | null;
	[key: string]: unknown;
}

export interface CredentialStore {
	get(provider: string, name: string): Promise<CredentialMetadata | null>;
	list(): Promise<CredentialMetadata[]>;
	upsert(entry: Omit<CredentialMetadata, "createdAt">): Promise<void>;
	delete(provider: string, name: string): Promise<void>;
	getSecrets(
		provider: string,
		name: string,
	): Promise<CredentialSecretBundle | null>;
	setSecrets(
		provider: string,
		name: string,
		secrets: CredentialSecretBundle,
		metadata?: Partial<
			Omit<CredentialMetadata, "provider" | "name" | "createdAt">
		>,
	): Promise<void>;
}

export interface TenantConfigEntry {
	key: string;
	value: Record<string, unknown>;
	updatedAt: Date | null;
}

export interface ConfigStore {
	list(): Promise<TenantConfigEntry[]>;
	get(key: string): Promise<TenantConfigEntry | null>;
	set(key: string, value: Record<string, unknown>): Promise<TenantConfigEntry>;
	delete(key: string): Promise<void>;
}

// ─── Logger (structural — avoids hard pino dep) ──────────────────────────

export interface PluginLogger {
	trace(msg: string, ...args: unknown[]): void;
	debug(msg: string, ...args: unknown[]): void;
	info(msg: string, ...args: unknown[]): void;
	warn(msg: string, ...args: unknown[]): void;
	error(msg: string, ...args: unknown[]): void;
	fatal(msg: string, ...args: unknown[]): void;
	child(bindings: Record<string, unknown>): PluginLogger;
}

// ─── Plugin context ──────────────────────────────────────────────────────

export interface PluginContext {
	stores: { credential: CredentialStore; config: ConfigStore };
	publicBaseUrl: string;
	logger: PluginLogger;
}

// ─── Safe function types ─────────────────────────────────────────────────

export type SafeFunctionTag =
	| "readonly"
	| "discovery"
	| "debug"
	| "io"
	| "data"
	| "llm"
	| "auth"
	| "experimental"
	| "deprecated"
	| string;

export type SafeFunctionCategory =
	| "core"
	| "data"
	| "llm"
	| "google"
	| "github"
	| "coding"
	| "file"
	| "network"
	| "utility"
	| string;

export interface SafeFunctionMetadata {
	category?: SafeFunctionCategory;
	tags?: SafeFunctionTag[];
	readonly?: boolean;
	discovery?: boolean;
	debug?: boolean;
	version?: string;
	relatedTo?: string[];
	[key: string]: unknown;
}

export interface SafeFunctionDocs {
	summary?: string;
	parameters?: Array<{
		name: string;
		type: string;
		description: string;
		example?: string;
		optional?: boolean;
		defaultValue?: string;
	}>;
	returns?: { type: string; description: string; example?: string };
	examples?: Array<{ title: string; description?: string; code: string }>;
	caveats?: string[];
	seeAlso?: string[];
}

export interface SafeFunction {
	name: string;
	// biome-ignore lint/suspicious/noExplicitAny: mirrors monorepo SafeFunction.handler — handler signatures are inherently variable
	handler: (...args: any[]) => any;
	description?: string;
	returnType?: string;
	typeDeclarations?: string;
	parameters?: Array<{
		name: string;
		type: string;
		description?: string;
		optional?: boolean;
	}>;
	requiredCredentials?: string[];
	resolveSecretRefs?: boolean;
	metadata?: SafeFunctionMetadata;
	docs?: SafeFunctionDocs;
	injectAgentContext?: boolean;
	timeout?: number;
	moduleName?: string;
}

// ─── Plugin config / tables / manifest ───────────────────────────────────

export interface PluginConfigDefinition {
	title?: string;
	description?: string;
	schema: AnyZodLikeSchema;
}

export interface PluginTableSchema {
	name: string;
	columns: Array<{
		name: string;
		type: string;
		notNull?: boolean;
		default?: string | number | boolean | null;
		description?: string;
		tsType?: string;
	}>;
	description?: string;
}

export interface PluginManifest {
	name: string;
	version: string;
	description: string;
	entry?: string;
	auth?: {
		type: "oauth2" | "token";
		provider: string;
		scopes?: string[];
		callbackPath?: string;
		firstParty?: boolean;
		label?: string;
		hint?: string;
	};
	tables?: PluginTableSchema[];
	pluginType?: "native" | "mcp";
	source?: "catalog" | "custom";
	[key: string]: unknown;
}

// ─── Auth + HTTP extension points ────────────────────────────────────────

export interface AuthMeta {
	displayName?: string;
	configField?: {
		label: string;
		placeholder?: string;
	};
}

export interface AuthProvider {
	type: "oauth2" | "token";
	authMeta?: AuthMeta;
	initiate(credentialName: string): Promise<{ authUrl: string; state: string }>;
	handleCallback(
		req: Request,
	): Promise<{ success: boolean; credentialName: string; error?: string }>;
	refresh?(bundle: Record<string, unknown>): Promise<Record<string, unknown>>;
	configure?(json: string, credentialName: string): Promise<void>;
	storeToken?(credentialName: string, token: string): Promise<void>;
	authSetup?(
		options: Record<string, string>,
	): Promise<{ success: boolean; message?: string; error?: string }>;
	isFirstPartyAvailable?(): Promise<boolean>;
}

export interface HttpEndpoint {
	method: "GET" | "POST";
	path: string;
	handler: (req: Request) => Response | Promise<Response>;
}

// ─── Plugin module / factory ─────────────────────────────────────────────

export interface PluginModule {
	safeFunctions?: SafeFunction[];
	httpEndpoints?: HttpEndpoint[];
	authProvider?: AuthProvider;
	config?: PluginConfigDefinition;
	onLoad?: (ctx: PluginContext) => Promise<void>;
}

export type PluginFactory = (
	ctx: PluginContext,
) => PluginModule | Promise<PluginModule>;
