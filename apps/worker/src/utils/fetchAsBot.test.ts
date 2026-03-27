import { Writable } from "stream";
import { mockEndpoint } from "../../test-utils/server.ts";
import {
	RobotDeniedError,
	fetchAsBot,
	fetchAsBotStream,
	resetCache,
} from "./fetchAsBot.ts";

beforeEach(() => resetCache());

describe("fetchAsBot", () => {
	test("Should throw error when a 400 status code is returned", async () => {
		const robotsUrl = new URL("https://example.com/robots.txt");
		const url = new URL("https://example.com/test");

		mockEndpoint({
			path: robotsUrl,
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});
		mockEndpoint({
			path: url,
			body: "",
			status: 400,
		});

		const response = fetchAsBot({ url, method: "GET" });
		await expect(response).rejects.toThrow();
	});

	test("Should return successful data for a URL with no robots.txt", async () => {
		const robotsUrl = new URL("https://example.com/robots.txt");
		const url = new URL("https://example.com/test");

		mockEndpoint({
			path: robotsUrl,
			status: 404,
			body: "",
		});
		mockEndpoint({
			path: url,
			body: "Hello!",
		});

		const response = await fetchAsBot({ url, method: "GET" });
		const body = await response.body.text();
		expect(body).toBe("Hello!");
	});

	test("Should return successful data for a URL with a valid robots.txt", async () => {
		const robotsUrl = new URL("https://example.com/robots.txt");
		const url = new URL("https://example.com/test");

		mockEndpoint({
			path: robotsUrl,
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});
		mockEndpoint({
			path: url,
			body: "Hello!",
		});

		const response = await fetchAsBot({ url, method: "GET" });
		const body = await response.body.text();
		expect(body).toBe("Hello!");
	});

	test("Should not return data for a URL disallowed by robots.txt", async () => {
		const robotsUrl = new URL("https://example.com/robots.txt");
		const url = new URL("https://example.com/test");

		mockEndpoint({
			path: robotsUrl,
			body: "User-agent: *\nDisallow: /test\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const response = await fetchAsBot({ url, method: "GET" }).catch((e) => e);
		expect(response).to.be.instanceOf(RobotDeniedError);
		expect((response as Error).message).toBe(
			"playful-programming/1.0 is disallowed from example.com!",
		);
	});
});

describe("fetchAsBotStream", () => {
	test("Should throw error when a 400 status code is returned", async () => {
		const robotsUrl = new URL("https://example.com/robots.txt");
		const url = new URL("https://example.com/test");

		mockEndpoint({
			path: robotsUrl,
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});
		mockEndpoint({
			path: url,
			body: "",
			status: 400,
		});

		await expect(
			fetchAsBotStream({
				url,
				method: "GET",
				writable: new Writable({
					write(_, __, next) {
						next();
					},
				}),
			}),
		).rejects.toThrow();
	});

	test("Should return successful data for a URL with no robots.txt", async () => {
		const robotsUrl = new URL("https://example.com/robots.txt");
		const url = new URL("https://example.com/test");

		mockEndpoint({
			path: robotsUrl,
			status: 404,
			body: "",
		});
		mockEndpoint({
			path: url,
			body: "Hello!",
			repeatTimes: 2,
		});

		let body = "";
		await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _, next) {
					body += chunk;
					next();
				},
			}),
		});
		expect(body).toBe("Hello!");
	});

	test("Should return successful data for a URL with a valid robots.txt", async () => {
		const robotsUrl = new URL("https://example.com/robots.txt");
		const url = new URL("https://example.com/test");

		mockEndpoint({
			path: robotsUrl,
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});
		mockEndpoint({
			path: url,
			body: "Hello!",
			repeatTimes: 2,
		});

		let body = "";
		await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _, next) {
					body += chunk;
					next();
				},
			}),
		});
		expect(body).toBe("Hello!");
	});

	test("Should not return data for a URL disallowed by robots.txt", async () => {
		const robotsUrl = new URL("https://example.com/robots.txt");
		const url = new URL("https://example.com/test");

		mockEndpoint({
			path: robotsUrl,
			body: "User-agent: *\nDisallow: /test\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const error = await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable(),
		}).catch((e) => e as Error);
		expect(error).toBeInstanceOf(RobotDeniedError);
		expect(error?.message).toBe(
			`playful-programming/1.0 is disallowed from ${url.hostname}!`,
		);
	});
});
