import type {
	PluginContext,
	PluginFactory,
	PluginModule,
} from "@orgsdk/plugins";
import { z } from "zod";
import { MyAuthProvider } from "./auth-provider";
import { safeFunctions } from "./functions";

const createPlugin: PluginFactory = (ctx: PluginContext): PluginModule => {
	const authProvider = new MyAuthProvider(ctx);

	return {
		safeFunctions,
		authProvider,
		config: {
			title: "My Plugin",
			description: "Default settings for this plugin. Replace with your own.",
			schema: z.object({
				defaultOption: z
					.string()
					.optional()
					.describe("An example default setting."),
			}),
		},
		async onLoad() {
			const cred = await ctx.stores.credential.get("my-service", "default");
			if (!cred) {
				ctx.logger.warn(
					"[my-plugin] No credential found. Add it in the dashboard (Credentials tab).",
				);
			}
		},
	};
};

export default createPlugin;
