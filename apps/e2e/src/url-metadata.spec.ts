import { describe, test, expect, vi } from "vitest";

describe("url-metadata", () => {
	test("returns url-metadata", async () => {
		const tap = mock.taps.inject(
			{
				response: `
				<!DOCTYPE html>
				<html lang="en">
					<head>
						<title>Example Title</title>
					</head>
				</html>
				`,
				statusCode: 200,
				headers: { "Content-Type": "text/html" },
			},
			{
				url: "/",
				hostname: "example.com",
				method: "GET",
			},
		);

		const url = `https://example.com/`;

		// Enqueue the URL metadata task
		const enqueueRes = await client.POST("/tasks/url-metadata", {
			body: { url },
		});
		expect(enqueueRes.response.status).toBe(201);

		// Wait for the task to be processed
		const res = await vi.waitFor(
			async () => {
				// Fetch the processed result
				const res = await client.POST("/tasks/url-metadata", {
					body: { url },
				});
				expect(res.response.status).toBe(200);
				return res;
			},
			{ timeout: 3000, interval: 100 },
		);

		expect(res.data).toStrictEqual({
			title: "Example Title",
			error: false,
		});

		mock.taps.removeInjection(tap);
	});
});
