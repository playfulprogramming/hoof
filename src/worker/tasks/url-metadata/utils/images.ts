import sharp from "sharp";
import * as stream from "stream";
import * as svgo from "svgo";
import { fetchAsBrowser } from "./html.ts";
import path from "path";
import crypto from "crypto";
import { FastifyInstance } from "fastify";

export async function processImage(
	url: URL,
	width: number,
	bucket: string,
	key: string,
	tags: Record<string, string>,
	fastify: FastifyInstance, // Add fastify parameter
): Promise<string> {
	const request = await fetchAsBrowser(url);
	const body = request.body;
	if (!body) throw new Error(`Request body for ${url} is null`);

	const urlHash = crypto.createHash("md5").update(url.href).digest("hex");

	if (path.extname(url.pathname) === ".svg") {
		const uploadKey = `${key}-${urlHash}.svg`;

		if (await fastify.s3.exists(bucket, uploadKey)) {
			await body.cancel();
			return uploadKey;
		}

		const svg = await request.text();
		const optimizedSvg = svgo.optimize(svg, { multipass: true }).data;
		await fastify.s3.upload(
			bucket,
			uploadKey,
			tags,
			stream.Readable.from([optimizedSvg]),
			"image/svg+xml",
		);
		return uploadKey;
	}

	const pipeline = sharp();
	const metadataStream = stream.Readable.fromWeb(body as never).pipe(pipeline);
	const metadata = await pipeline.metadata();

	if (!metadata.format) {
		throw new Error(`Image format for ${url} could not be found.`);
	}

	const uploadKey = `${key}-${urlHash}.${metadata.format}`;
	if (await fastify.s3.exists(bucket, uploadKey)) {
		return uploadKey;
	}

	const transformer = sharp().resize(Math.min(width, metadata.width || width));
	const transformerStream = metadataStream.pipe(transformer);

	await fastify.s3.upload(
		bucket,
		uploadKey,
		tags,
		transformerStream,
		`image/${metadata.format}`,
	);

	return uploadKey;
}
