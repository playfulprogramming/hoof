import sharp from "sharp";
import * as stream from "stream";
import * as svgo from "svgo";
import path from "path";
import crypto from "crypto";
import { env } from "@playfulprogramming/common";
import { s3 } from "@playfulprogramming/s3";
import { fetchAsBot } from "../../../utils/fetchAsBot.ts";
import { setTimeout } from "timers/promises";

interface ProcessImageResult {
	key: string;
	width?: number;
	height?: number;
}

async function compareLastModified(
	request: Response,
	bucket: string,
	key: string,
): Promise<boolean> {
	// If there is a last-modified header, compare it to the header from S3
	if (request.headers.has("last-modified")) {
		const existingFile = await fetchAsBot(
			new URL(`${bucket}/${key}`, env.S3_PUBLIC_URL),
			{
				method: "HEAD",
				skipRobotsCheck: true,
			},
		).catch(() => undefined);

		if (existingFile && existingFile.ok) {
			const modS3 = existingFile.headers.get("last-modified");
			const modExternal = request.headers.get("last-modified");

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
): Promise<ProcessImageResult | undefined> {
	const request = await fetchAsBot(url).catch((e) => {
		console.error(`Error fetching ${url}`, e);
		if (e instanceof DOMException && e.name === "TimeoutError") {
			throw e;
		}
		return undefined;
	});
	const body = request?.body;
	if (!body) {
		console.error(`Request body for ${url} is null`);
		return undefined;
	}

	const urlHash = crypto.createHash("md5").update(url.href).digest("hex");

	const isSvg =
		request.headers.get("content-type")?.includes("image/svg") ||
		(!request.headers.has("content-type") &&
			path.extname(url.pathname) === ".svg");

	if (isSvg) {
		const uploadKey = `${key}-${urlHash}.svg`;

		if (await compareLastModified(request, bucket, uploadKey)) {
			console.log(`Skipping ${uploadKey}, as it has already been stored.`);
			await body.cancel();
		} else {
			const svg = await request.text();
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
	const metadataStream = stream.Readable.fromWeb(body as never).pipe(pipeline);
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

	if (await compareLastModified(request, bucket, uploadKey)) {
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

export async function processImages(
	urls: URL[],
	width: number,
	bucket: string,
	key: string,
	tag?: string,
): Promise<ProcessImageResult | undefined> {
	for (const url of urls) {
		const result = await processImage(url, width, bucket, key, tag);
		if (result) {
			return result;
		}
	}
}
