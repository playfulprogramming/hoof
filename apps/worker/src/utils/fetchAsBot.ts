import { request, stream, type Dispatcher } from "undici";
import { LRUCache } from "lru-cache";
import robotsParserDefault, { type Robot } from "robots-parser";
import type { Writable } from "stream";
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
		const robotsResponse = await fetchAsBot({
			url: robotsUrl,
			method: "GET",
			headers: { "User-Agent": userAgent },
			skipRobotsCheck: true,
		}).catch(() => undefined);

		if (!robotsResponse) {
			return undefined;
		}

		if (
			robotsResponse.headers["content-type"]?.includes("text/plain") != true
		) {
			await robotsResponse.body.dump();
			return undefined;
		}

		robots = await robotsResponse.body.text();
		robotsCache.set(robotsUrl.toString(), robots);
	}

	return robotsParser(robotsUrl.toString(), robots);
}

type FetchAsBotInit = Omit<
	Dispatcher.RequestOptions<null>,
	"origin" | "path"
> & {
	url: string | URL;
	skipRobotsCheck?: boolean;
	maxLength?: number;
	followRedirects?: number;
};

export class RobotDeniedError extends Error {
	constructor(message?: string) {
		super(message);
	}
}

export async function fetchAsBot(options: FetchAsBotInit) {
	const {
		url,
		skipRobotsCheck,
		maxLength,
		followRedirects = 10,
		...init
	} = options;
	const parsedUrl = url instanceof URL ? url : new URL(url);
	if (!skipRobotsCheck) {
		const robots = await getRobots(parsedUrl);

		if (robots && robots.isDisallowed(url.toString(), userAgent)) {
			throw new RobotDeniedError(
				`${userAgent} is disallowed from ${parsedUrl.hostname}!`,
			);
		}
	}

	console.debug(init.method ?? "GET", parsedUrl.href);

	const response = await request(url, {
		...init,
		headers: {
			"User-Agent": userAgent,
			"Accept-Language": "en",
			...init?.headers,
		},
		signal: init?.signal ?? AbortSignal.timeout(10 * 1000),
	});

	if (response.statusCode == 301 || response.statusCode == 302) {
		await response.body.dump();
		const newLocation = response.headers["location"]?.toString();
		console.log(`redirect (${response.statusCode})`);

		if (followRedirects > 0 && newLocation && URL.canParse(newLocation)) {
			const newUrl = new URL(newLocation);
			return await fetchAsBot({
				...options,
				url: newUrl,
				followRedirects: followRedirects - 1,
			});
		}
	}

	if (response.statusCode < 200 || response.statusCode > 299) {
		await response.body.dump();
		throw new Error(`Request ${url} returned ${response.statusCode}`);
	}

	return response;
}

export async function fetchAsBotStream({
	url,
	skipRobotsCheck,
	maxLength,
	writable,
	...init
}: FetchAsBotInit & { writable: Writable }) {
	const parsedUrl = url instanceof URL ? url : new URL(url);
	if (!skipRobotsCheck) {
		const robots = await getRobots(parsedUrl);

		if (robots && robots.isDisallowed(url.toString(), userAgent)) {
			throw new RobotDeniedError(
				`${userAgent} is disallowed from ${parsedUrl.hostname}!`,
			);
		}
	}

	console.debug(init.method ?? "GET", parsedUrl.href);

	await stream(
		url,
		{
			...init,
			headers: {
				"User-Agent": userAgent,
				"Accept-Language": "en",
				...init?.headers,
			},
			signal: init?.signal ?? AbortSignal.timeout(10 * 1000),
			opaque: writable,
		},
		({ opaque }) => opaque,
	);
}
