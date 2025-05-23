import {
	s3,
	type PostImageInput,
	type PostImageOutput,
} from "@playfulprogramming/common";
import { db, postImages } from "@playfulprogramming/db";
import {
	fetchPostData,
	createPostImage,
	banner,
	linkPreview,
} from "@playfulprogramming/post-images";

export async function processPostImages(job: {
	id?: string;
	data: PostImageInput;
}): Promise<PostImageOutput> {
	const BUCKET = await s3.createBucket(process.env.S3_BUCKET);

	const data = await fetchPostData(job.data);
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

	await db.insert(postImages).values({
		slug: data.slug,
		bannerKey,
		linkPreviewKey,
	});

	return {
		bannerKey,
		linkPreviewKey,
	};
}
