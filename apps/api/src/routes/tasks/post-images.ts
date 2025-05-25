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
import { queueEvents, queues } from "../../utils/queues.ts";

const PostImagesResponseSchema = Type.Object(
	{
		banner: Type.String(),
		linkPreview: Type.String(),
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
		banner: new URL(result.bannerKey, s3PublicUrl).toString(),
		linkPreview: new URL(result.linkPreviewKey, s3PublicUrl).toString(),
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

			if (result) {
				reply.code(200);
				reply.send(mapPostImages(result));
				return;
			}

			const job = await queues[Tasks.POST_IMAGES].add(
				request.body.slug,
				{
					...request.body,
				},
				{
					deduplication: {
						id: request.body.slug,
					},
				},
			);

			const jobResult = await job.waitUntilFinished(
				queueEvents[Tasks.POST_IMAGES]!,
				10 * 1000,
			);

			reply.code(200);
			reply.send(mapPostImages(jobResult));
		},
	);
};

export default postImagesRoutes;
