import { createWriteStream } from "fs";
import { LRUCache } from "lru-cache";
import { devNull } from "os";
import robotsParserDefault, { type Robot } from "robots-parser";
import { type Writable } from "stream";
import { request, stream, type Dispatcher } from "undici";
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

async function checkRobotsAccess(url: URL) {
	const robots = await getRobots(url);

	if (robots && robots.isDisallowed(url.toString(), userAgent)) {
		throw new RobotDeniedError(
			`${userAgent} is disallowed from ${url.hostname}!`,
		);
	}
}

type FetchAsBotInit = Omit<
	Dispatcher.RequestOptions<null>,
	"origin" | "path" | "method"
> & {
	url: string | URL;
	method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
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
		await checkRobotsAccess(parsedUrl);
	}

	console.log(init.method ?? "GET", parsedUrl.href);

	const response = await request(parsedUrl, {
		...init,
		headers: {
			"User-Agent": userAgent,
			"Accept-Language": "en",
			...init?.headers,
		},
		signal: init?.signal ?? AbortSignal.timeout(10 * 1000),
	});

	if (
		[301, 302, 303, 307, 308].includes(response.statusCode) &&
		followRedirects > 0
	) {
		await response.body.dump();
		const newLocation = response.headers["location"]?.toString() ?? "";
		const newLocationUrl = URL.parse(newLocation, parsedUrl.origin);

		if (newLocationUrl) {
			console.log(
				`redirect (${response.statusCode}) [${parsedUrl} -> ${newLocationUrl}]`,
			);

			if (!["https:", "http:"].includes(newLocationUrl.protocol)) {
				throw new Error(`Invalid redirect protocol for ${parsedUrl}`);
			}

			return await fetchAsBot({
				...options,
				url: newLocationUrl,
				followRedirects: followRedirects - 1,
			});
		} else {
			throw new Error(
				`The redirect location ${newLocation} couldn't be parsed as a URL for ${parsedUrl}`,
			);
		}
	}

	if (response.statusCode < 200 || response.statusCode > 299) {
		await response.body.dump();
		throw new Error(`Request ${parsedUrl} returned ${response.statusCode}`);
	}

	return response;
}

interface FetchAsBotStreamFactoryOpaque {
	writable: Writable;
	followRedirects: number;
	currentUrl: URL;
	redirect: boolean;
	error: Error | null;
}

const fetchAsBotStreamFactory: Dispatcher.StreamFactory<
	FetchAsBotStreamFactoryOpaque
> = ({ opaque, statusCode, headers }) => {
	opaque.redirect = false;

	if (
		[301, 302, 303, 307, 308].includes(statusCode) &&
		opaque.followRedirects > 0
	) {
		const newLocation = headers["location"]?.toString() ?? "";
		const newLocationUrl = URL.parse(newLocation, opaque.currentUrl.origin);
		if (newLocationUrl) {
			console.log(
				`redirect (${statusCode}) [${opaque.currentUrl} -> ${newLocationUrl}]`,
			);

			if (!["https:", "http:"].includes(newLocationUrl.protocol)) {
				opaque.error = new Error(
					`Invalid redirect protocol for ${opaque.currentUrl}`,
				);
				return createWriteStream(devNull);
			}

			opaque.currentUrl = newLocationUrl;
			opaque.followRedirects -= 1;
			opaque.redirect = true;
		} else {
			opaque.error = new Error(
				`The redirect location ${newLocation} couldn't be parsed as a URL for ${opaque.currentUrl}`,
			);
		}

		return createWriteStream(devNull);
	}

	if (statusCode < 200 || statusCode > 299) {
		opaque.error = new Error(
			`Request ${opaque.currentUrl} returned ${statusCode}`,
		);

		return createWriteStream(devNull);
	}

	return opaque.writable;
};

export async function fetchAsBotStream({
	url,
	skipRobotsCheck,
	maxLength,
	writable,
	followRedirects = 10,
	...init
}: FetchAsBotInit & { writable: Writable }) {
	const parsedUrl = url instanceof URL ? url : new URL(url);

	console.log(init.method ?? "GET", parsedUrl.href);

	const opaque: FetchAsBotStreamFactoryOpaque = {
		writable,
		followRedirects,
		currentUrl: parsedUrl,
		redirect: false,
		error: null,
	};

	while (true) {
		if (!skipRobotsCheck) {
			await checkRobotsAccess(parsedUrl);
		}

		await stream(
			opaque.currentUrl,
			{
				...init,
				headers: {
					"User-Agent": userAgent,
					"Accept-Language": "en",
					...init?.headers,
				},
				signal: init?.signal ?? AbortSignal.timeout(10 * 1000),
				opaque,
			},
			fetchAsBotStreamFactory,
		);

		if (opaque.error) {
			throw opaque.error;
		}

		if (!opaque.redirect) {
			break;
		}
	}
}
