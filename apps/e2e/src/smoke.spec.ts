import { describe, it, expect } from "vitest";
import { spawnAppWithClient } from "./lib/spawn-app.ts";

describe("E2E: Health Check", () => {
	it("should spawn app and hit health endpoint", async () => {
		await using app = await spawnAppWithClient();

		const res = await app.client.GET("/", {
			parseAs: "text",
		});
		expect(res.response.status).toBe(200);
		expect(res.data).toBe("OK");
	});
});
