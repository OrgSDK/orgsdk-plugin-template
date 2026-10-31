import assert from "node:assert/strict";

export default async function createFixture() {
	return {
		configuration: {},
		provider: "my-service",
		secret: { secret_apiKey: "synthetic-key" },
		async fetch(request) {
			const url = new URL(request.url);
			assert.fail(`Template must not access a provider: ${url}`);
		},
		async run(call) {
			assert.deepEqual(await call("example", { input: "hello" }), {
				message: "You sent: hello",
			});
		},
	};
}
