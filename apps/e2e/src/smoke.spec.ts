import { describe, it, expect } from "vitest";
import { spawnAppWithClient } from "./lib/spawn-app.ts";

describe("E2E: Health Check", () => {
	it.each(["/", "/health/postgres", "/health/redis"] as const)(
		"should respond 200 for %s",
		async (path) => {
			await using app = await spawnAppWithClient();

			const res = await app.client.GET(path, {
				parseAs: "text",
			});
			expect(res.response.status).toBe(200);
			expect(res.data).toBe("OK");
		},
	);
});
