import { Tasks, env } from "@playfulprogramming/common";
import { db, postImages } from "@playfulprogramming/db";
import {
	fetchPostData,
	createPostImage,
	banner,
	linkPreview,
} from "@playfulprogramming/post-images";
import { s3 } from "@playfulprogramming/s3";
import { createProcessor } from "../../createProcessor.ts";
import type {
	LayoutFunction,
	PostImageData,
} from "@playfulprogramming/post-images/src/types.ts";

async function createAndUploadPostImage(
	data: PostImageData,
	key: string,
	layout: LayoutFunction,
	signal: AbortSignal,
) {
	const BUCKET = await s3.createBucket(env.S3_BUCKET);
	await createPostImage(layout, data).then((buf) => {
		signal.throwIfAborted();
		return s3.upload(BUCKET, key, undefined, buf, "image/png");
	});
	return key;
}

export default createProcessor(Tasks.POST_IMAGES, async (job, { signal }) => {
	let error = false;

	const dataPromise = fetchPostData(job.data, signal);

	const bannerKeyLocal = `post-images/${job.data.slug}.banner.png`;
	const linkPreviewKeyLocal = `post-images/${job.data.slug}.link-preview.png`;

	const [bannerKey, linkPreviewKey] = await Promise.all([
		dataPromise
			.then((data) =>
				createAndUploadPostImage(data, bannerKeyLocal, banner, signal),
			)
			.catch((e) => {
				console.error(`Unable to generate post banner for ${job.data.slug}`, e);
				error = true;
				return undefined;
			}),
		dataPromise
			.then((data) =>
				createAndUploadPostImage(
					data,
					linkPreviewKeyLocal,
					linkPreview,
					signal,
				),
			)
			.catch((e) => {
				console.error(
					`Unable to generate post link preview for ${job.data.slug}`,
					e,
				);
				error = true;
				return undefined;
			}),
	]);

	const result = {
		bannerKey: bannerKey ?? null,
		linkPreviewKey: linkPreviewKey ?? null,
		error,
	};

	await db
		.insert(postImages)
		.values({
			slug: job.data.slug,
			fetchedAt: new Date(),
			...result,
		})
		.onConflictDoUpdate({ target: postImages.slug, set: result });

	return result;
});
