import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import {
	type PostImageInput,
	PostImageInputSchema,
	type PostImageOutput,
	Tasks,
	env,
} from "@playfulprogramming/common";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "@sinclair/typebox";
import { createJob } from "../../utils/queues.ts";

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
		Body: PostImageInput;
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
							schema: PostImageInputSchema,
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
				// if 30 days has passed after metadata was last fetched, revalidate it
				const stale = new Date(
					result.fetchedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
				);
				if (result.error || new Date() > stale) {
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
