import sharp from "sharp";
import * as stream from "stream";
import * as svgo from "svgo";
import path from "path";
import crypto from "crypto";
import { env } from "@playfulprogramming/common";
import { s3 } from "@playfulprogramming/s3";
import { fetchAsBot } from "../../../utils/fetchAsBot.ts";
import { setTimeout } from "timers/promises";
import type { Dispatcher } from "undici";

export interface ProcessImageResult {
	key: string;
	width?: number;
	height?: number;
}

async function compareLastModified(
	request: Dispatcher.ResponseData<null>,
	bucket: string,
	key: string,
	signal?: AbortSignal,
): Promise<boolean> {
	// If there is a last-modified header, compare it to the header from S3
	const lastModified = request.headers["last-modified"]?.toString();
	if (lastModified) {
		const existingFile = await fetchAsBot({
			url: new URL(`${bucket}/${key}`, env.S3_PUBLIC_URL),
			method: "HEAD",
			skipRobotsCheck: true,
			signal,
		}).catch(() => undefined);

		if (existingFile && existingFile.statusCode == 200) {
			const modS3 = existingFile.headers["last-modified"]?.toString();
			const modExternal = lastModified;

			if (modS3 && modExternal) {
				return new Date(modS3) > new Date(modExternal);
			} else {
				console.error("File exists in S3, but has no last-modified header.");
				return false;
			}
		}
	}

	return false;
}

async function uploadSvg(
	svg: string,
	bucket: string,
	uploadKey: string,
	tag: string | undefined,
): Promise<void> {
	const optimizedSvg = svgo.optimize(svg, { multipass: true }).data;
	await s3.upload(
		bucket,
		uploadKey,
		tag,
		stream.Readable.from([optimizedSvg]),
		"image/svg+xml",
	);
}

async function uploadRasterImage(
	body: NodeJS.ReadableStream,
	url: URL,
	urlHash: string,
	width: number,
	bucket: string,
	key: string,
	tag: string | undefined,
	signal: AbortSignal | undefined,
	// undefined for sources with no HTTP resource to compare a last-modified
	// header against (e.g. data: URLs) - always upload in that case
	request: Dispatcher.ResponseData<null> | undefined,
): Promise<ProcessImageResult | undefined> {
	const pipeline = sharp();
	const metadataStream = body.pipe(pipeline);
	const metadata = await Promise.race([
		setTimeout(10 * 1000).then(() => undefined),
		pipeline.metadata().catch(() => undefined),
	]);

	if (!metadata || !metadata.format) {
		console.error(`Image format for ${url} could not be found.`);
		return undefined;
	}

	const uploadKey = `${key}-${urlHash}.${metadata.format}`;

	const transformWidth = Math.min(width, metadata.width || width);
	const transformHeight =
		metadata.height && metadata.width
			? Math.round(metadata.height * (transformWidth / metadata.width))
			: undefined;

	const alreadyStored =
		request !== undefined &&
		(await compareLastModified(request, bucket, uploadKey, signal));

	if (alreadyStored) {
		console.log(`Skipping ${uploadKey}, as it has already been stored.`);
		metadataStream.destroy();
	} else {
		const transformer = sharp().resize(transformWidth);
		const transformerStream = metadataStream.pipe(transformer);

		await s3.upload(
			bucket,
			uploadKey,
			tag,
			transformerStream,
			`image/${metadata.format}`,
		);
	}

	return {
		key: uploadKey,
		width: transformWidth,
		height: transformHeight,
	};
}

interface ParsedDataUrl {
	mediaType: string;
	isBase64: boolean;
	payload: string;
}

// The WHATWG URL parser treats `data:` as an opaque-path scheme, so an
// unescaped `#` in the payload gets split off into url.hash and url.pathname
// alone silently loses everything after it. url.href keeps the full string
// intact, so parse the data:<mediatype>[;base64],<payload> shape from there.
function parseDataUrl(url: URL): ParsedDataUrl | undefined {
	const href = url.href;
	const commaIndex = href.indexOf(",");
	if (!href.startsWith("data:") || commaIndex === -1) {
		return undefined;
	}

	const meta = href.slice("data:".length, commaIndex);
	const payload = href.slice(commaIndex + 1);
	const isBase64 = /;base64$/i.test(meta);
	const mediaType =
		(isBase64 ? meta.slice(0, -";base64".length) : meta) ||
		"text/plain;charset=US-ASCII";

	return { mediaType, isBase64, payload };
}

async function processDataUrlImage(
	url: URL,
	width: number,
	bucket: string,
	key: string,
	tag: string | undefined,
	signal: AbortSignal | undefined,
): Promise<ProcessImageResult | undefined> {
	const parsed = parseDataUrl(url);
	if (!parsed) {
		console.error(`Unable to parse data URL ${url}`);
		return undefined;
	}

	const urlHash = crypto.createHash("md5").update(url.href).digest("hex");
	const isSvg = parsed.mediaType.includes("image/svg");

	if (isSvg) {
		const svg = parsed.isBase64
			? Buffer.from(parsed.payload, "base64").toString("utf-8")
			: decodeURIComponent(parsed.payload);

		const uploadKey = `${key}-${urlHash}.svg`;
		await uploadSvg(svg, bucket, uploadKey, tag);
		return { key: uploadKey };
	}

	const buffer = parsed.isBase64
		? Buffer.from(parsed.payload, "base64")
		: Buffer.from(decodeURIComponent(parsed.payload), "utf-8");

	const body = stream.Readable.from(buffer);

	return uploadRasterImage(
		body,
		url,
		urlHash,
		width,
		bucket,
		key,
		tag,
		signal,
		undefined,
	);
}

async function processImage(
	url: URL,
	width: number,
	bucket: string,
	key: string,
	tag?: string,
	signal?: AbortSignal,
): Promise<ProcessImageResult | undefined> {
	if (url.protocol === "data:") {
		return processDataUrlImage(url, width, bucket, key, tag, signal);
	}

	const request = await fetchAsBot({ url, method: "GET", signal }).catch(
		(e) => {
			console.error(`Error fetching ${url}`, e);
			if (e instanceof DOMException && e.name === "TimeoutError") {
				throw e;
			}
			return undefined;
		},
	);
	const body = request?.body;
	if (!body) {
		console.error(`Request body for ${url} is null`);
		return undefined;
	}

	const urlHash = crypto.createHash("md5").update(url.href).digest("hex");

	const isSvg =
		request.headers["content-type"]?.includes("image/svg") ||
		(!("content-type" in request.headers) &&
			path.extname(url.pathname) === ".svg");

	if (isSvg) {
		const uploadKey = `${key}-${urlHash}.svg`;

		if (await compareLastModified(request, bucket, uploadKey, signal)) {
			console.log(`Skipping ${uploadKey}, as it has already been stored.`);
			await body.dump();
		} else {
			const svg = await body.text();
			await uploadSvg(svg, bucket, uploadKey, tag);
		}

		return { key: uploadKey };
	}

	const result = await uploadRasterImage(
		body,
		url,
		urlHash,
		width,
		bucket,
		key,
		tag,
		signal,
		request,
	);
	await body.dump();
	return result;
}

export async function processImages(
	urls: URL[],
	width: number,
	bucket: string,
	key: string,
	tag?: string,
	signal?: AbortSignal,
): Promise<ProcessImageResult | undefined> {
	for (const url of urls) {
		const result = await processImage(url, width, bucket, key, tag, signal);
		if (result) {
			return result;
		}
	}
}
