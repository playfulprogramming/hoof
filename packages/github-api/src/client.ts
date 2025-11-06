import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./generated/schema.d.ts";
import * as undici from "undici";
import { env } from "@playfulprogramming/common";

async function fetchWrapper(input: Request): Promise<Response> {
	return undici.fetch(
		new undici.default.Request(input.url, input),
	) as unknown as Promise<Response>;
}

export const client = createClient<paths>({
	baseUrl: "https://api.github.com",
	fetch: fetchWrapper,
	headers: {
		"User-Agent": env.GITHUB_REPO_OWNER,
		Authorization: env.GITHUB_TOKEN ? `Bearer ${env.GITHUB_TOKEN}` : undefined,
	},
});

export function clientWithType<T extends `${string}/${string}`>(
	_: T,
): Client<paths, T> {
	return client;
}
