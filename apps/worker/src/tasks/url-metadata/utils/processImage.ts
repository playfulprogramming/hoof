import sharp from "sharp";
import * as stream from "stream";
import * as svgo from "svgo";
import { fetchAsBrowser } from "./fetchPageHtml.ts";
import path from "path";
import crypto from "crypto";
import { s3 } from "@playfulprogramming/common";

interface ProcessImageResult {
	key: string;
	width?: number;
	height?: number;
}

export async function processImage(
	url: URL,
	width: number,
	bucket: string,
	key: string,
	tag?: string,
): Promise<ProcessImageResult> {
	const request = await fetchAsBrowser(url);
	const body = request.body;
	if (!body) throw new Error(`Request body for ${url} is null`);

	const urlHash = crypto.createHash("md5").update(url.href).digest("hex");

	if (path.extname(url.pathname) === ".svg") {
		const uploadKey = `${key}-${urlHash}.svg`;

		const svg = await request.text();
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

	const pipeline = sharp();
	const metadataStream = stream.Readable.fromWeb(body as never).pipe(pipeline);
	const metadata = await pipeline.metadata();

	if (!metadata.format) {
		throw new Error(`Image format for ${url} could not be found.`);
	}

	const uploadKey = `${key}-${urlHash}.${metadata.format}`;

	const transformWidth = Math.min(width, metadata.width || width);
	const transformHeight =
		metadata.height && metadata.width
			? Math.round(metadata.height * (transformWidth / metadata.width))
			: undefined;
	const transformer = sharp().resize(transformWidth);
	const transformerStream = metadataStream.pipe(transformer);

	await s3.upload(
		bucket,
		uploadKey,
		tag,
		transformerStream,
		`image/${metadata.format}`,
	);

	return {
		key: uploadKey,
		width: transformWidth,
		height: transformHeight,
	};
}
