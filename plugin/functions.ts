import type { SafeFunction } from "./contract";

/** Replace this interface with your function's return type. */
interface ExampleResult {
	message: string;
}

export const safeFunctions: SafeFunction[] = [
	{
		name: "example",
		requiredCredentials: ["my-service"],
		handler: async (
			credentials: Record<string, unknown>,
			params: { input: string },
		): Promise<ExampleResult> => {
			// Extract the API key from the injected credentials.
			const providerCreds = credentials["my-service"] as
				| Record<string, unknown>
				| undefined;
			const apiKey = providerCreds?.secret_apiKey as string | undefined;
			if (!apiKey) {
				throw new Error(
					"API key not configured. Add it in the dashboard (Credentials tab).",
				);
			}

			// Replace with your actual API call.
			return { message: `You sent: ${params.input}` };
		},
		description: "An example safe function. Replace with your own.",
		returnType: "Promise<ExampleResult>",
		typeDeclarations: `
			interface ExampleResult {
				message: string;
			}
		`,
		parameters: [
			{
				name: "input",
				type: "string",
				description: "The input string to echo back.",
			},
		],
		metadata: {
			category: "utility",
			tags: ["readonly", "discovery"],
			readonly: true,
			discovery: true,
			version: "1.0.0",
		},
		docs: {
			summary:
				"An example function that echoes the input. Replace with your own.",
			parameters: [
				{
					name: "input",
					type: "string",
					description: "The input string to echo back.",
					example: '"hello world"',
				},
			],
			returns: {
				type: "Promise<ExampleResult>",
				description: "An object with a message field.",
			},
			examples: [
				{
					title: "Basic usage",
					code: 'const result = await example({ input: "hello" });\nconsole.log(result.message);',
				},
			],
		},
	},
];
