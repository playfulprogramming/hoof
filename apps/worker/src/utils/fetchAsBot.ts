import { LRUCache } from "lru-cache";
import robotsParserDefault, { type Robot } from "robots-parser";
const robotsParser =
	robotsParserDefault as never as typeof robotsParserDefault.default;

const userAgent = "playful-programming/1.0";
const robotsCache = new LRUCache<string, string>({ max: 100 });

export function resetCache() {
	robotsCache.clear();
}

async function getRobots(input: URL): Promise<Robot | undefined> {
	const robotsUrl = new URL("/robots.txt", input);
	let robots = robotsCache.get(robotsUrl.toString());

	if (!robots) {
		const robotsResponse = await fetch(robotsUrl, {
			headers: { "User-Agent": userAgent },
			signal: AbortSignal.timeout(10 * 1000),
			cache: "force-cache",
		}).catch(() => undefined);

		if (!robotsResponse || !robotsResponse.ok) {
			return undefined;
		}

		if (
			robotsResponse.headers.has("content-type") &&
			!robotsResponse.headers.get("content-type")?.includes("text/plain")
		) {
			return undefined;
		}

		robots = await robotsResponse.text();
		robotsCache.set(robotsUrl.toString(), robots);
	}

	return robotsParser(robotsUrl.toString(), robots);
}

type FetchAsBotInit = RequestInit & {
	skipRobotsCheck?: boolean;
};

export class RobotDeniedError extends Error {
	constructor(message?: string) {
		super(message);
	}
}

export async function fetchAsBot(input: URL, init?: FetchAsBotInit) {
	if (!init?.skipRobotsCheck) {
		const robots = await getRobots(input);

		if (robots && robots.isDisallowed(input.toString(), userAgent)) {
			throw new RobotDeniedError(
				`${userAgent} is disallowed from ${input.hostname}!`,
			);
		}
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
