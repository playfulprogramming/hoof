import { createApp } from "../../../api/src/index.ts";
import createClient, { type Client } from "openapi-fetch";
import type { paths } from "../generated/api-schema.d.ts";

export type TestApp = {
	baseUrl: string;
} & AsyncDisposable;

export type TestAppWithClient = TestApp & {
	client: Client<paths>;
} & AsyncDisposable;

export async function spawnApp(): Promise<TestApp> {
	const app = createApp();

	await app.listen({ port: 0, host: "127.0.0.1" });

	const address = app.server.address();
	if (!address || typeof address === "string") {
		throw new Error("Failed to get server address");
	}

	const baseUrl = `http://127.0.0.1:${address.port}`;
	console.log(`Spawned test app at ${baseUrl}`);
	return {
		baseUrl,
		[Symbol.asyncDispose]: async () => {
			await app.close();
			console.log(`Closed test app at ${baseUrl}`);
		},
	};
}

export async function spawnAppWithClient(): Promise<TestAppWithClient> {
	const app = await spawnApp();

	const client = createClient<paths>({
		baseUrl: app.baseUrl,
	});

	return {
		baseUrl: app.baseUrl,
		client,
		[Symbol.asyncDispose]: async () => {
			await app[Symbol.asyncDispose]();
			console.log(`Closed test app with client at ${app.baseUrl}`);
		},
	};
}
