import { createWriteStream } from "fs";
import { devNull } from "os";
import { Writable } from "stream";
import { request } from "undici";
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

	test("Should return data for a URL disallowed by robots.txt when skipRobotsCheck is true", async () => {
		const robotsUrl = new URL("https://example.com/robots.txt");
		mockEndpoint({
			path: robotsUrl,
			body: "User-agent: *\nDisallow: /test\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("https://example.com/test");
		const mockedBody = "Hello!";
		mockEndpoint({
			path: url,
			body: mockedBody,
		});

		const response = await fetchAsBot({
			url,
			method: "GET",
			skipRobotsCheck: true,
		});

		expect(await response.body.text()).toBe(mockedBody);

		// Consume the remaining robots.txt mock so afterEach has no pending interceptors
		await request(robotsUrl);
	});

	test("Should handle single redirect", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectPath = "/another-test";
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectPath,
			},
			status: 301,
		});

		const redirectedUrl = new URL(redirectPath, baseUrl);
		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectedUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		const response = await fetchAsBot({
			url,
			method: "GET",
		});

		expect(await response.body.text()).toBe(redirectionBody);
	});

	test("Should handle chain of redirects", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const redirectionBody = "This is the redirection result.";
		for (let i = 1; i <= 3; i++) {
			if (i === 3) {
				mockEndpoint({
					path: new URL(`/${i}`, baseUrl),
					body: redirectionBody,
					headers: {
						"content-type": "text/plain",
					},
				});
				continue;
			}

			mockEndpoint({
				path: new URL(`/${i}`, baseUrl),
				body: "Redirecting..",
				headers: {
					"content-type": "text/plain",
					location: new URL(`/${i + 1}`, baseUrl).toString(),
				},
				status: 301,
			});
		}

		const response = await fetchAsBot({
			url: new URL("/1", baseUrl),
			method: "GET",
		});

		expect(await response.body.text()).toBe(redirectionBody);
	});

	test("Should throw error when redirect limit is exceeded", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		for (let i = 1; i <= 12; i++) {
			if (i === 12) {
				mockEndpoint({
					path: new URL(`/${i}`, baseUrl),
					body: "This is the redirection result.",
					headers: {
						"content-type": "text/plain",
					},
				});
				continue;
			}

			mockEndpoint({
				path: new URL(`/${i}`, baseUrl),
				body: "Redirecting..",
				headers: {
					"content-type": "text/plain",
					location: `/${i + 1}`,
				},
				status: 302,
			});
		}

		const response = await fetchAsBot({
			url: new URL("/1", baseUrl),
			method: "GET",
		}).catch((e) => e as Error);

		expect(response).toBeInstanceOf(Error);

		// Consume the remaining redirect mocks so afterEach has no pending interceptors
		await request(new URL("/12", baseUrl));
	});

	test("Should throw error when redirecting to invalid location", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const invalidLocation = "http://[invalid-url";
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: invalidLocation,
			},
			status: 303,
		});

		const response = await fetchAsBot({
			url: new URL("/test", baseUrl),
			method: "GET",
		}).catch((e) => e as Error);

		expect.assert(
			response instanceof Error === true,
			"Expected an error to be thrown",
		);
		expect(response.message).toBe(
			`The redirect location ${invalidLocation} couldn't be parsed as a URL for ${url}`,
		);
	});

	test("Should throw error when location header is missing on redirect", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
			},
			status: 307,
		});

		const response = await fetchAsBot({
			url: new URL("/test", baseUrl),
			method: "GET",
		}).catch((e) => e as Error);

		expect.assert(
			response instanceof Error === true,
			"Expected an error to be thrown",
		);
		expect(response.message).toBe(
			`The redirect location undefined couldn't be parsed as a URL for ${url}`,
		);
	});

	test("Should throw error when redirecting to unsupported protocol", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: "ftp://example.com/file",
			},
			status: 308,
		});

		const response = await fetchAsBot({
			url: new URL("/test", baseUrl),
			method: "GET",
		}).catch((e) => e as Error);

		expect.assert(
			response instanceof Error === true,
			"Expected an error to be thrown",
		);
		expect(response.message).toBe(`Invalid redirect protocol for ${url}`);
	});

	test("Should handle absolute redirects", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectPath = "/another-test";
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectPath,
			},
			status: 301,
		});

		const redirectedUrl = new URL(redirectPath, baseUrl);
		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectedUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		const response = await fetchAsBot({
			url,
			method: "GET",
		});

		expect(await response.body.text()).toBe(redirectionBody);
	});

	test("Should handle relative redirects", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test/", baseUrl);
		const redirectPath = "another-test";
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectPath,
			},
			status: 301,
		});

		const redirectedUrl = new URL(redirectPath, url);
		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectedUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		const response = await fetchAsBot({
			url,
			method: "GET",
		});

		expect(await response.body.text()).toBe(redirectionBody);
	});

	test("Should handle full URL redirects", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectUrl = new URL("/another-test", baseUrl);
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectUrl.toString(),
			},
			status: 301,
		});

		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		const response = await fetchAsBot({
			url,
			method: "GET",
		});

		expect(await response.body.text()).toBe(redirectionBody);
	});

	test("Should handle cross-domain redirects", async () => {
		const baseUrl = "https://example.com";
		const redirectBaseUrl = "https://example.net";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});
		mockEndpoint({
			path: new URL("/robots.txt", redirectBaseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectUrl = new URL("/test", redirectBaseUrl);
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectUrl.toString(),
			},
			status: 301,
		});

		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		const response = await fetchAsBot({
			url,
			method: "GET",
		});

		expect(await response.body.text()).toBe(redirectionBody);
	});

	test("Should throw error when redirected location in same domain is disallowed by robots.txt", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow: /another-test\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectPath = "/another-test";
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectPath,
			},
			status: 301,
		});

		const redirectedUrl = new URL(redirectPath, url);
		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectedUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		const response = await fetchAsBot({
			url,
			method: "GET",
		}).catch((e) => e as Error);

		expect.assert(
			response instanceof Error === true,
			"Expected an error to be thrown",
		);
		expect(response.message).toBe(
			`playful-programming/1.0 is disallowed from ${url.hostname}!`,
		);

		// Consume the remaining redirect mock so afterEach has no pending interceptors
		await request(redirectedUrl);
	});

	test("Should throw error when redirected location in different domain is disallowed by robots.txt", async () => {
		const baseUrl = "https://example.com";
		const redirectBaseUrl = "https://example.net";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});
		mockEndpoint({
			path: new URL("/robots.txt", redirectBaseUrl),
			body: "User-agent: *\nDisallow: /test\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectUrl = new URL("/test", redirectBaseUrl);
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectUrl.toString(),
			},
			status: 301,
		});

		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		const response = await fetchAsBot({
			url,
			method: "GET",
		}).catch((e) => e as Error);

		expect.assert(
			response instanceof Error === true,
			"Expected an error to be thrown",
		);
		expect(response.message).toBe(
			`playful-programming/1.0 is disallowed from ${redirectUrl.hostname}!`,
		);

		// Consume the remaining redirect mock so afterEach has no pending interceptors
		await request(redirectUrl);
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

		const botFetchStream = fetchAsBotStream({
			url,
			method: "GET",
			writable: createWriteStream(devNull),
		});

		await expect(botFetchStream).rejects.toThrow();
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

		let body = "";
		await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
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
		});

		let body = "";
		await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
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
			writable: createWriteStream(devNull),
		}).catch((e) => e as Error);

		expect(error).toBeInstanceOf(RobotDeniedError);
		expect(error?.message).toBe(
			`playful-programming/1.0 is disallowed from ${url.hostname}!`,
		);
	});

	test("Should return data for a URL disallowed by robots.txt when skipRobotsCheck is true", async () => {
		const robotsUrl = new URL("https://example.com/robots.txt");
		mockEndpoint({
			path: robotsUrl,
			body: "User-agent: *\nDisallow: /test\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("https://example.com/test");
		const mockedBody = "Hello!";
		mockEndpoint({
			path: url,
			body: mockedBody,
		});

		let body = "";
		await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
					body += chunk;
					next();
				},
			}),
			skipRobotsCheck: true,
		});

		expect(body).toBe(mockedBody);

		// Consume the remaining robots.txt mock so afterEach has no pending interceptors
		await request(robotsUrl);
	});

	test("Should handle single redirect", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectPath = "/another-test";
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectPath,
			},
			status: 301,
		});

		const redirectedUrl = new URL(redirectPath, baseUrl);
		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectedUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		let body = "";
		await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
					body += chunk;
					next();
				},
			}),
		});

		expect(body).toBe(redirectionBody);
	});

	test("Should handle chain of redirects", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const redirectionBody = "This is the redirection result.";
		for (let i = 1; i <= 3; i++) {
			if (i === 3) {
				mockEndpoint({
					path: new URL(`/${i}`, baseUrl),
					body: redirectionBody,
					headers: {
						"content-type": "text/plain",
					},
				});
				continue;
			}

			mockEndpoint({
				path: new URL(`/${i}`, baseUrl),
				body: "Redirecting..",
				headers: {
					"content-type": "text/plain",
					location: new URL(`/${i + 1}`, baseUrl).toString(),
				},
				status: 301,
			});
		}

		let body = "";
		await fetchAsBotStream({
			url: new URL("/1", baseUrl),
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
					body += chunk;
					next();
				},
			}),
		});

		expect(body).toBe(redirectionBody);
	});

	test("Should throw error when redirect limit is exceeded", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		for (let i = 1; i <= 12; i++) {
			if (i === 12) {
				mockEndpoint({
					path: new URL(`/${i}`, baseUrl),
					body: "This is the redirection result.",
					headers: {
						"content-type": "text/plain",
					},
				});
				continue;
			}

			mockEndpoint({
				path: new URL(`/${i}`, baseUrl),
				body: "Redirecting..",
				headers: {
					"content-type": "text/plain",
					location: `/${i + 1}`,
				},
				status: 302,
			});
		}

		let body = "";
		const error = await fetchAsBotStream({
			url: new URL("/1", baseUrl),
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
					body += chunk;
					next();
				},
			}),
		}).catch((e) => e as Error);

		expect(body).toBe("");
		expect(error).toBeInstanceOf(Error);

		// Consume the remaining redirect mocks so afterEach has no pending interceptors
		await request(new URL("/12", baseUrl));
	});

	test("Should throw error when redirecting to invalid location", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const invalidLocation = "http://[invalid-url";
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: invalidLocation,
			},
			status: 303,
		});

		const error = await fetchAsBotStream({
			url: new URL("/test", baseUrl),
			method: "GET",
			writable: createWriteStream(devNull),
		}).catch((e) => e as Error);

		expect(error).toBeInstanceOf(Error);
		expect(error?.message).toBe(
			`The redirect location ${invalidLocation} couldn't be parsed as a URL for ${url}`,
		);
	});

	test("Should throw error when location header is missing on redirect", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
			},
			status: 307,
		});

		const error = await fetchAsBotStream({
			url: new URL("/test", baseUrl),
			method: "GET",
			writable: createWriteStream(devNull),
		}).catch((e) => e as Error);

		expect(error).toBeInstanceOf(Error);
		expect(error?.message).toBe(
			`The redirect location undefined couldn't be parsed as a URL for ${url}`,
		);
	});

	test("Should throw error when redirecting to unsupported protocol", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: "ftp://example.com/file",
			},
			status: 308,
		});

		const error = await fetchAsBotStream({
			url: new URL("/test", baseUrl),
			method: "GET",
			writable: createWriteStream(devNull),
		}).catch((e) => e as Error);

		expect(error).toBeInstanceOf(Error);
		expect(error?.message).toBe(`Invalid redirect protocol for ${url}`);
	});

	test("Should handle absolute redirects", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectPath = "/another-test";
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectPath,
			},
			status: 301,
		});

		const redirectedUrl = new URL(redirectPath, baseUrl);
		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectedUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		let body = "";
		await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
					body += chunk;
					next();
				},
			}),
		});

		expect(body).toBe(redirectionBody);
	});

	test("Should handle relative redirects", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test/", baseUrl);
		const redirectPath = "another-test";
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectPath,
			},
			status: 301,
		});

		const redirectedUrl = new URL(redirectPath, url);
		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectedUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		let body = "";
		await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
					body += chunk;
					next();
				},
			}),
		});

		expect(body).toBe(redirectionBody);
	});

	test("Should handle full URL redirects", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectUrl = new URL("/another-test", baseUrl);
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectUrl.toString(),
			},
			status: 301,
		});

		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		let body = "";
		await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
					body += chunk;
					next();
				},
			}),
		});

		expect(body).toBe(redirectionBody);
	});

	test("Should handle cross-domain redirects", async () => {
		const baseUrl = "https://example.com";
		const redirectBaseUrl = "https://example.net";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});
		mockEndpoint({
			path: new URL("/robots.txt", redirectBaseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectUrl = new URL("/test", redirectBaseUrl);
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectUrl.toString(),
			},
			status: 301,
		});

		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		let body = "";
		await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
					body += chunk;
					next();
				},
			}),
		});

		expect(body).toBe(redirectionBody);
	});

	test("Should throw error when redirected location in same domain is disallowed by robots.txt", async () => {
		const baseUrl = "https://example.com";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow: /another-test\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectPath = "/another-test";
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectPath,
			},
			status: 301,
		});

		const redirectedUrl = new URL(redirectPath, url);
		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectedUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		let body = "";
		const error = await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
					body += chunk;
					next();
				},
			}),
		}).catch((e) => e as Error);

		expect(body).toBe("");
		expect(error).toBeInstanceOf(Error);
		expect(error?.message).toBe(
			`playful-programming/1.0 is disallowed from ${url.hostname}!`,
		);

		// Consume the remaining redirect mock so afterEach has no pending interceptors
		await request(redirectedUrl);
	});

	test("Should throw error when redirected location in different domain is disallowed by robots.txt", async () => {
		const baseUrl = "https://example.com";
		const redirectBaseUrl = "https://example.net";

		mockEndpoint({
			path: new URL("/robots.txt", baseUrl),
			body: "User-agent: *\nDisallow:\n",
			headers: {
				"content-type": "text/plain",
			},
		});
		mockEndpoint({
			path: new URL("/robots.txt", redirectBaseUrl),
			body: "User-agent: *\nDisallow: /test\n",
			headers: {
				"content-type": "text/plain",
			},
		});

		const url = new URL("/test", baseUrl);
		const redirectUrl = new URL("/test", redirectBaseUrl);
		mockEndpoint({
			path: url,
			body: "Redirecting..",
			headers: {
				"content-type": "text/plain",
				location: redirectUrl.toString(),
			},
			status: 301,
		});

		const redirectionBody = "This is the redirection result.";
		mockEndpoint({
			path: redirectUrl,
			body: redirectionBody,
			headers: {
				"content-type": "text/plain",
			},
		});

		let body = "";
		const error = await fetchAsBotStream({
			url,
			method: "GET",
			writable: new Writable({
				write(chunk, _encoding, next) {
					body += chunk;
					next();
				},
			}),
		}).catch((e) => e as Error);

		expect(body).toBe("");
		expect(error).toBeInstanceOf(Error);
		expect(error?.message).toBe(
			`playful-programming/1.0 is disallowed from ${redirectUrl.hostname}!`,
		);

		// Consume the remaining redirect mock so afterEach has no pending interceptors
		await request(redirectUrl);
	});
});
