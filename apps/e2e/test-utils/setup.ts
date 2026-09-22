import { env } from "../src/util/env.ts";
import createClient from "openapi-fetch";
import type { paths } from "../src/generated/api-schema.js";

const apiClient = createClient<paths>({
	baseUrl: env.API_URL,
});

declare global {
	var client: typeof apiClient;
}

globalThis.client = apiClient;
