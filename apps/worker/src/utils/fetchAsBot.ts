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
		const robotsResponse = await fetchAsBot(robotsUrl, {
			headers: { "User-Agent": userAgent },
			cache: "force-cache",
			skipRobotsCheck: true,
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
	maxLength?: number;
};

export class RobotDeniedError extends Error {
	constructor(message?: string) {
		super(message);
	}
}

const DEFAULT_MAX_LENGTH = 1000 * 1000; // 1MB (in bytes)

export async function fetchAsBot(input: URL, init?: FetchAsBotInit) {
	if (!init?.skipRobotsCheck) {
		const robots = await getRobots(input);

		if (robots && robots.isDisallowed(input.toString(), userAgent)) {
			throw new RobotDeniedError(
				`${userAgent} is disallowed from ${input.hostname}!`,
			);
		}
	}

	console.debug("GET", input.href);

	const response = await fetch(input, {
		...init,
		headers: {
			"User-Agent": userAgent,
			"Accept-Language": "en",
			...init?.headers,
		},
		signal: init?.signal ?? AbortSignal.timeout(10 * 1000),
	});

	if (!response.ok) {
		throw new Error(`Request ${input} returned ${response.status}`);
	}

	const maxLength = init?.maxLength ?? DEFAULT_MAX_LENGTH;
	const contentLength = Number(response.headers.get("content-length"));
	if (!isFinite(contentLength) || contentLength > maxLength) {
		throw new Error(
			`Response body '${input}' is larger than the max length. (${contentLength} > ${maxLength} bytes)`,
		);
	}

	return response;
}
