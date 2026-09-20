import { env } from "@playfulprogramming/common";
import { s3 } from "@playfulprogramming/s3";
import sharp from "sharp";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export async function uploadProcessedImage(
	stream: ReadableStream<Uint8Array>,
	uploadKey: string,
	maxSize: number,
	signal: AbortSignal,
) {
	const transform = sharp()
		.resize({ width: maxSize, height: maxSize, fit: "inside" })
		.jpeg({ mozjpeg: true });

	const source = Readable.fromWeb(stream as never);

	const bucket = await s3.ensureBucket(env.S3_BUCKET);

	// Abort the pipeline too if upload rejects first - nothing else destroys the streams
	const uploadFailureController = new AbortController();
	const combinedSignal = AbortSignal.any([
		signal,
		uploadFailureController.signal,
	]);

	const upload = s3
		.upload(bucket, uploadKey, undefined, transform, "image/jpeg")
		.catch((err: unknown) => {
			uploadFailureController.abort(err);
			throw err;
		});

	await Promise.all([
		pipeline(source, transform, { signal: combinedSignal }),
		upload,
	]);
}
