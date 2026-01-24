import { createApp } from "../../../api/src/index.ts";
import createClient, { type Client } from "openapi-fetch";
import type { paths } from "../generated/api-schema.d.ts";

export type TestApp = {
	baseUrl: string;
	port: number;
} & AsyncDisposable;

export type TestAppWithClient = TestApp & {
	client: Client<paths>;
} & AsyncDisposable;

export async function spawnApp(): Promise<TestApp> {
	const app = createApp();

	await app.listen({ port: 0, host: "127.0.0.1" });

	const address = app.server.address();
	const port = typeof address === "string" ? address : address?.port;
	if (!port) throw new Error("Failed to get server port");

	const baseUrl = `http://127.0.0.1:${port}`;
	return {
		baseUrl,
		port: Number(port),
		[Symbol.asyncDispose]: async () => {
			await app.close();
		},
	};
}

export async function spawnAppWithClient(): Promise<TestAppWithClient> {
	const app = await spawnApp();

	const client = createClient<paths>({
		baseUrl: app.baseUrl,
	});

	return {
		...app,
		client,
		[Symbol.asyncDispose]: async () => {
			await app[Symbol.asyncDispose]();
		},
	};
}
