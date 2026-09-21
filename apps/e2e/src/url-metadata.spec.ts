import { describe, test, expect } from "vitest";
import { setTimeout } from "node:timers/promises";

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
		await setTimeout(2000);

		// Fetch the processed result
		const res = await client.POST("/tasks/url-metadata", {
			body: { url },
		});
		expect(res.response.status).toBe(200);
		expect(res.data).toStrictEqual({
			title: "Example Title",
			error: false,
		});

		mock.taps.removeInjection(tap);
	});
});
