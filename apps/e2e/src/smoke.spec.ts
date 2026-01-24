import { describe, it, expect } from "vitest";
import { spawnApp } from "./lib/spawn-app.ts";

describe("E2E: Health Check", () => {
	it("should spawn app and hit health endpoint", async () => {
		await using app = await spawnApp();

		const res = await fetch(`${app.baseUrl}/`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});
});
