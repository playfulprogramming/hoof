import robotsParserDefault, { type Robot } from "robots-parser";
const robotsParser =
	robotsParserDefault as never as typeof robotsParserDefault.default;

const userAgent = "playful-programming/1.0";

async function getRobots(input: URL): Promise<Robot | undefined> {
	const robotsUrl = new URL("/robots.txt", input);
	const robotsResponse = await fetch(robotsUrl, {
		headers: { "User-Agent": userAgent },
		signal: AbortSignal.timeout(10 * 1000),
		cache: "force-cache",
	}).catch(() => undefined);

	if (
		!robotsResponse ||
		(robotsResponse.status > 400 && robotsResponse.status < 499)
	) {
		return undefined;
	}

	if (!robotsResponse.ok) {
		throw Error(
			`GET robots.txt for ${input.hostname} returned ${robotsResponse.status}`,
		);
	}

	if (
		robotsResponse.headers.has("content-type") &&
		!robotsResponse.headers.get("content-type")?.includes("text/plain")
	) {
		return undefined;
	}

	return robotsParser(robotsUrl.toString(), await robotsResponse.text());
}

export async function fetchAsBot(input: URL, init?: RequestInit) {
	const robots = await getRobots(input);

	if (robots && robots.isDisallowed(input.toString(), userAgent)) {
		throw new Error(`${userAgent} is disallowed from ${input.hostname}!`);
	}

	const response = await fetch(input, {
		...init,
		headers: {
			"User-Agent": userAgent,
			"Accept-Language": "en",
			...init?.headers,
		},
		signal: AbortSignal.timeout(10 * 1000),
	});

	if (!response.ok)
		throw new Error(`Request ${input} returned ${response.status}`);

	return response;
}
