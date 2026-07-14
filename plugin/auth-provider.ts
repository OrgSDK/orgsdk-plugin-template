import type { AuthProvider, PluginContext } from "@orgsdk/plugins";

/**
 * Placeholder token auth provider.
 *
 * Replace `my-service` with your credential provider key, and adjust the
 * `storeToken` / `authSetup` field names to match your API's credential shape.
 */
export class MyAuthProvider implements AuthProvider {
	readonly type = "token" as const;
	readonly authMeta = { displayName: "My Service" };
	private readonly ctx: PluginContext;

	constructor(ctx: PluginContext) {
		this.ctx = ctx;
	}

	async initiate(
		credentialName: string,
	): Promise<{ authUrl: string; state: string }> {
		return {
			authUrl: `Add the credential '${credentialName}' in the dashboard (Credentials tab).`,
			state: "",
		};
	}

	async handleCallback(
		_req: Request,
	): Promise<{ success: boolean; credentialName: string; error?: string }> {
		return {
			success: false,
			credentialName: "",
			error: "Token auth has no callback flow",
		};
	}

	async storeToken(credentialName: string, token: string): Promise<void> {
		await this.ctx.stores.credential.setSecrets(
			"my-service",
			credentialName,
			{ secret_apiKey: token },
			{ label: `My Service (${credentialName})`, valid: true },
		);
	}

	async authSetup(
		options: Record<string, string>,
	): Promise<{ success: boolean; message?: string; error?: string }> {
		const token = options.token ?? "";
		const name = options.name ?? "default";
		if (!token) return { success: false, error: "Missing --token" };
		await this.storeToken(name, token);
		return {
			success: true,
			message: `Saved credential 'my-service/${name}'.`,
		};
	}
}
