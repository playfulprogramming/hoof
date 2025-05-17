import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import {
	type UrlMetadataInput,
	UrlMetadataInputSchema,
	queues,
} from "@playfulprogramming/common";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "@sinclair/typebox";

const UrlMetadataResponseSchema = Type.Object({
	title: Type.Optional(Type.String()),
	icon: Type.Optional(Type.String()),
	banner: Type.Optional(Type.String()),
});

function getPublicUrl(key: string): string {
	const s3PublicUrl = `${process.env.S3_PUBLIC_URL}/${process.env.S3_BUCKET}/`;
	return new URL(key, s3PublicUrl).toString();
}

const urlMetadataRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{
		Body: UrlMetadataInput;
		Reply: Static<typeof UrlMetadataResponseSchema>;
	}>(
		"/tasks/url-metadata",
		{
			schema: {
				body: UrlMetadataInputSchema,
				response: {
					200: {
						description: "Task complete",
						content: {
							"application/json": {
								schema: UrlMetadataResponseSchema,
							},
						},
					},
					202: {
						description: "Task created",
					},
				},
			},
		},
		async (request, reply) => {
			// Normalize URL
			const inputUrl = new URL(request.body.url);
			const normalizedUrl = new URL(
				inputUrl.pathname,
				inputUrl.origin.toLowerCase(),
			).toString();

			const existingMetadata = await db.query.urlMetadata.findFirst({
				where: (metadata) => eq(metadata.url, normalizedUrl),
			});

			if (existingMetadata) {
				reply.code(200);
				reply.send({
					title: existingMetadata.title || undefined,
					icon: existingMetadata.icon
						? getPublicUrl(existingMetadata.icon)
						: undefined,
					banner: existingMetadata.banner
						? getPublicUrl(existingMetadata.banner)
						: undefined,
				});
				return;
			}

			await queues["url-metadata"].add(
				normalizedUrl,
				{
					...request.body,
					url: normalizedUrl,
				},
				{
					deduplication: {
						id: normalizedUrl,
					},
				},
			);

			reply.code(202);
		},
	);
};

export default urlMetadataRoutes;
