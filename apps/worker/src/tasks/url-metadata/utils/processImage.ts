import sharp from "sharp";
import * as stream from "stream";
import * as svgo from "svgo";
import path from "path";
import crypto from "crypto";
import { env } from "@playfulprogramming/common";
import { s3 } from "@playfulprogramming/s3";
import { fetchAsBot } from "../../../utils/fetchAsBot.ts";
import { setTimeout } from "timers/promises";

export interface ProcessImageResult {
	key: string;
	width?: number;
	height?: number;
}

interface ReadImageResult {
	body: stream.Readable;
	format: string;
	width?: number;
	height?: number;
	// undefined for sources with no HTTP resource to compare a last-modified
	// header against (e.g. data: URLs) - always upload in that case
	lastModified?: Date;
}

async function compareLastModified(
	lastModified: Date,
	bucket: string,
	key: string,
	signal?: AbortSignal,
): Promise<boolean> {
	const existingFile = await fetchAsBot({
		url: new URL(`${bucket}/${key}`, env.S3_PUBLIC_URL),
		method: "HEAD",
		skipRobotsCheck: true,
		signal,
	}).catch(() => undefined);

	if (existingFile && existingFile.statusCode == 200) {
		const modS3 = existingFile.headers["last-modified"]?.toString();

		if (modS3) {
			return new Date(modS3) > lastModified;
		} else {
			console.error("File exists in S3, but has no last-modified header.");
			return false;
		}
	}

	return false;
}

async function readStreamToBuffer(readable: stream.Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of readable) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}

async function uploadSvg(
	body: stream.Readable,
	bucket: string,
	uploadKey: string,
	tag: string | undefined,
): Promise<ProcessImageResult> {
	const svg = (await readStreamToBuffer(body)).toString("utf-8");
	const optimizedSvg = svgo.optimize(svg, { multipass: true }).data;
	await s3.upload(
		bucket,
		uploadKey,
		tag,
		stream.Readable.from([optimizedSvg]),
		"image/svg+xml",
	);
	return { key: uploadKey };
}

function computeRasterDimensions(
	image: Pick<ReadImageResult, "width" | "height">,
	width: number,
): { width: number; height?: number } {
	const transformWidth = Math.min(width, image.width || width);
	const transformHeight =
		image.height && image.width
			? Math.round(image.height * (transformWidth / image.width))
			: undefined;

	return { width: transformWidth, height: transformHeight };
}

async function uploadRasterImage(
	image: ReadImageResult,
	dimensions: { width: number; height?: number },
	bucket: string,
	uploadKey: string,
	tag: string | undefined,
): Promise<ProcessImageResult> {
	const transformer = sharp().resize(dimensions.width);
	const transformerStream = image.body.pipe(transformer);

	await s3.upload(
		bucket,
		uploadKey,
		tag,
		transformerStream,
		`image/${image.format}`,
	);

	return {
		key: uploadKey,
		width: dimensions.width,
		height: dimensions.height,
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

async function readRasterMetadata(
	body: stream.Readable,
	url: URL,
): Promise<ReadImageResult | undefined> {
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

	return {
		body: metadataStream,
		format: metadata.format,
		width: metadata.width,
		height: metadata.height,
	};
}

async function readDataUrlImage(
	url: URL,
): Promise<ReadImageResult | undefined> {
	const parsed = parseDataUrl(url);
	if (!parsed) {
		console.error(`Unable to parse data URL ${url}`);
		return undefined;
	}

	const isSvg = parsed.mediaType.includes("image/svg");
	if (isSvg) {
		const svg = parsed.isBase64
			? Buffer.from(parsed.payload, "base64").toString("utf-8")
			: decodeURIComponent(parsed.payload);

		return { body: stream.Readable.from([svg]), format: "svg" };
	}

	const buffer = parsed.isBase64
		? Buffer.from(parsed.payload, "base64")
		: Buffer.from(decodeURIComponent(parsed.payload), "utf-8");

	return readRasterMetadata(stream.Readable.from(buffer), url);
}

async function readFetchedImage(
	url: URL,
	signal: AbortSignal | undefined,
): Promise<ReadImageResult | undefined> {
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

	const lastModifiedHeader = request.headers["last-modified"]?.toString();
	const lastModified = lastModifiedHeader
		? new Date(lastModifiedHeader)
		: undefined;

	const isSvg =
		request.headers["content-type"]?.includes("image/svg") ||
		(!("content-type" in request.headers) &&
			path.extname(url.pathname) === ".svg");

	if (isSvg) {
		return { body, format: "svg", lastModified };
	}

	const raster = await readRasterMetadata(body, url);
	if (!raster) {
		return undefined;
	}

	return { ...raster, lastModified };
}

async function readImage(
	url: URL,
	signal: AbortSignal | undefined,
): Promise<ReadImageResult | undefined> {
	if (url.protocol === "data:") {
		return readDataUrlImage(url);
	}

	return readFetchedImage(url, signal);
}

async function processImage(
	url: URL,
	width: number,
	bucket: string,
	key: string,
	tag?: string,
	signal?: AbortSignal,
): Promise<ProcessImageResult | undefined> {
	const image = await readImage(url, signal);
	if (!image) {
		return undefined;
	}

	const urlHash = crypto.createHash("md5").update(url.href).digest("hex");
	const uploadKey = `${key}-${urlHash}.${image.format}`;

	const alreadyStored =
		image.lastModified !== undefined &&
		(await compareLastModified(image.lastModified, bucket, uploadKey, signal));

	if (alreadyStored) {
		console.log(`Skipping ${uploadKey}, as it has already been stored.`);
	}

	if (image.format === "svg") {
		if (alreadyStored) {
			image.body.destroy();
			return { key: uploadKey };
		}
		return uploadSvg(image.body, bucket, uploadKey, tag);
	}

	const dimensions = computeRasterDimensions(image, width);
	if (alreadyStored) {
		image.body.destroy();
		return { key: uploadKey, ...dimensions };
	}
	return uploadRasterImage(image, dimensions, bucket, uploadKey, tag);
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
