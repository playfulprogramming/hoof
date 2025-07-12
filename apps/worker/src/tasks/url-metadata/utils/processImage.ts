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

interface ProcessImageResult {
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

async function processImage(
	url: URL,
	width: number,
	bucket: string,
	key: string,
	tag?: string,
	signal?: AbortSignal,
): Promise<ProcessImageResult | undefined> {
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
			const optimizedSvg = svgo.optimize(svg, { multipass: true }).data;
			await s3.upload(
				bucket,
				uploadKey,
				tag,
				stream.Readable.from([optimizedSvg]),
				"image/svg+xml",
			);
		}

		return { key: uploadKey };
	}

	const pipeline = sharp();
	const metadataStream = body.pipe(pipeline);
	const metadata = await Promise.race([
		setTimeout(10 * 1000).then(() => undefined),
		pipeline.metadata().catch(() => undefined),
	]);

	if (!metadata || !metadata.format) {
		console.error(`Image format for ${url} could not be found.`);
		await body.dump();
		return undefined;
	}

	const uploadKey = `${key}-${urlHash}.${metadata.format}`;

	const transformWidth = Math.min(width, metadata.width || width);
	const transformHeight =
		metadata.height && metadata.width
			? Math.round(metadata.height * (transformWidth / metadata.width))
			: undefined;

	if (await compareLastModified(request, bucket, uploadKey, signal)) {
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

	await body.dump();

	return {
		key: uploadKey,
		width: transformWidth,
		height: transformHeight,
	};
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
