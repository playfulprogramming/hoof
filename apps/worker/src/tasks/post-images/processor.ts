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

	const data = await fetchPostData(job.data, signal);
	const bannerKey = `post-images/${data.slug}.banner.png`;
	const linkPreviewKey = `post-images/${data.slug}.link-preview.png`;
	await Promise.all([
		createPostImage(banner, data).then((buf) =>
			s3.upload(BUCKET, bannerKey, undefined, buf, "image/png"),
		),
		createPostImage(linkPreview, data).then((buf) =>
			s3.upload(BUCKET, linkPreviewKey, undefined, buf, "image/png"),
		),
	]);

	const result = {
		bannerKey,
		linkPreviewKey,
	};

	await db
		.insert(postImages)
		.values({
			slug: data.slug,
			...result,
		})
		.onConflictDoUpdate({ target: postImages.slug, set: result });

	return result;
});
