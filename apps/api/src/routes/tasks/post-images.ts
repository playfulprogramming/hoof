import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { type PostImageOutput, Tasks, env } from "@playfulprogramming/common";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "@sinclair/typebox";
import { createJob } from "../../utils/queues.ts";

const PostImageRequestSchema = Type.Object(
	{
		slug: Type.String(),
		// `path` and `author` are temporary, will be removed after https://github.com/playfulprogramming/hoof/issues/18
		author: Type.String(),
		path: Type.String(),
		indexMd5: Type.String(),
	},
	{
		additionalProperties: false,
		examples: [
			{
				slug: "example",
				author: "fennifith",
				path: "content/fennifith/posts/example/index.md",
				indexMd5: "6cd3556deb0da54bca060b4c39479839",
			},
		],
	},
);

const PostImagesResponseSchema = Type.Object(
	{
		banner: Type.Optional(Type.String()),
		linkPreview: Type.Optional(Type.String()),
	},
	{
		examples: [
			{
				banner:
					"http://localhost:9000/hoof-storage/post-images/example.banner.png",
				linkPreview:
					"http://localhost:9000/hoof-storage/post-images/example.link-preview.png",
			},
		],
	},
);

function mapPostImages(
	result: PostImageOutput,
): Static<typeof PostImagesResponseSchema> {
	const s3PublicUrl = `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/`;
	return {
		banner: result.bannerKey
			? new URL(result.bannerKey, s3PublicUrl).toString()
			: undefined,
		linkPreview: result.linkPreviewKey
			? new URL(result.linkPreviewKey, s3PublicUrl).toString()
			: undefined,
	};
}

const postImagesRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{
		Body: Static<typeof PostImageRequestSchema>;
		Reply: Static<typeof PostImagesResponseSchema>;
	}>(
		"/tasks/post-images",
		{
			schema: {
				description:
					"Generate static images for a post, to be used for social media metadata / post list banners.",
				body: {
					content: {
						"application/json": {
							schema: PostImageRequestSchema,
						},
					},
				},
				response: {
					200: {
						description: "Task complete",
						content: {
							"application/json": {
								schema: PostImagesResponseSchema,
							},
						},
					},
				},
			},
		},
		async (request, reply) => {
			const result = await db.query.postImages.findFirst({
				where: (postImages) => eq(postImages.slug, request.body.slug),
			});

			let shouldSubmitJob = false;

			if (result) {
				// if the task failed or if the md5 hash has changed, recreate the post images
				if (result.error || request.body.indexMd5 != result.indexMd5) {
					shouldSubmitJob = true;
				}

				reply.code(200);
				reply.send(mapPostImages(result));
			} else {
				shouldSubmitJob = true;
				reply.code(201);
			}

			if (shouldSubmitJob) {
				createJob(Tasks.POST_IMAGES, request.body.slug, {
					...request.body,
				});
			}
		},
	);
};

export default postImagesRoutes;
