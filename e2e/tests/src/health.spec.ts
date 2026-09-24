const app = await spawnApp();

describe("E2E: Health Check", () => {
	it.each(["/", "/health/postgres", "/health/redis"] as const)(
		"should respond 200 for %s",
		async (path) => {
			const res = await app.client.GET(path, {
				parseAs: "text",
			});
			expect(res.response.status).toBe(200);
			expect(res.data).toBe("OK");
		},
	);
});
