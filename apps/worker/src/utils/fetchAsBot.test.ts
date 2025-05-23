import { http, HttpResponse } from "msw";
import { server } from "../../test-utils/server.ts";
import { RobotDeniedError, fetchAsBot, resetCache } from "./fetchAsBot.ts";

beforeEach(() => resetCache());

test("Should throw error when a 400 status code is returned", async () => {
	const url = "https://example.com/test";

	server.use(
		http.get(
			"https://example.com/robots.txt",
			() => new HttpResponse("User-agent: *\nDisallow:\n"),
		),
		http.get(url, () => new HttpResponse("", { status: 400 })),
	);

	await expect(() => fetchAsBot(new URL(url))).rejects.toThrow();
});

test("Should return successful data for a URL with no robots.txt", async () => {
	const url = "https://example.com/test";

	server.use(
		http.get(
			"https://example.com/robots.txt",
			() => new HttpResponse("", { status: 404 }),
		),
		http.get(url, () => new HttpResponse("Hello!", { status: 200 })),
	);

	const response = await fetchAsBot(new URL(url));
	const body = await response.text();
	expect(body).toBe("Hello!");
});

test("Should return successful data for a URL with a valid robots.txt", async () => {
	const url = "https://example.com/test";

	server.use(
		http.get(
			"https://example.com/robots.txt",
			() => new HttpResponse("User-agent: *\nDisallow:\n", { status: 200 }),
		),
		http.get(url, () => new HttpResponse("Hello!", { status: 200 })),
	);

	const response = await fetchAsBot(new URL(url));
	const body = await response.text();
	expect(body).toBe("Hello!");
});

test("Should not return data for a URL disallowed by robots.txt", async () => {
	const url = "https://example.com/test";

	server.use(
		http.get(
			"https://example.com/robots.txt",
			() =>
				new HttpResponse("User-agent: *\nDisallow: /test\n", { status: 200 }),
		),
		http.get(url, () => new HttpResponse("Hello!", { status: 200 })),
	);

	const response = await fetchAsBot(new URL(url)).catch((e) => e);
	expect(response).to.be.instanceOf(RobotDeniedError);
	expect((response as Error).message).toBe(
		"playful-programming/1.0 is disallowed from example.com!",
	);
});
