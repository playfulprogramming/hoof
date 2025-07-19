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

export default createProcessor(Tasks.POST_IMAGES, async (job, { signal }) => {
	const BUCKET = await s3.createBucket(env.S3_BUCKET);

	let bannerKey: string | null = null;
	let linkPreviewKey: string | null = null;
	let error = false;

	const data = await fetchPostData(job.data, signal).catch((e) => {
		console.error(`Unable to fetch post data for ${job.data.slug}`, e);
		error = true;
		return undefined;
	});

	if (data) {
		const bannerKeyLocal = (bannerKey = `post-images/${data.slug}.banner.png`);
		const linkPreviewKeyLocal =
			(linkPreviewKey = `post-images/${data.slug}.link-preview.png`);

		await Promise.all([
			createPostImage(banner, data).then((buf) => {
				signal.throwIfAborted();
				return s3.upload(BUCKET, bannerKeyLocal, undefined, buf, "image/png");
			}),
			createPostImage(linkPreview, data).then((buf) => {
				signal.throwIfAborted();
				return s3.upload(
					BUCKET,
					linkPreviewKeyLocal,
					undefined,
					buf,
					"image/png",
				);
			}),
		]);
	}

	const result = {
		bannerKey,
		linkPreviewKey,
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
