import type { FastifyPluginAsync } from "fastify";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import {
	type UrlMetadataInput,
	UrlMetadataInputSchema,
	queues,
} from "@playfulprogramming/common";
import { db } from "@playfulprogramming/db";
import { Type } from "@sinclair/typebox";

const UrlMetadataResponseSchema = Type.Object({
	title: Type.Optional(Type.String()),
	icon: Type.Optional(Type.String()),
	banner: Type.Optional(Type.String()),
});

const urlMetadataRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{ Body: UrlMetadataInput }>(
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

			const urlHash = createHash("md5").update(normalizedUrl).digest("hex");

			const existingMetadata = await db.query.urlMetadata.findFirst({
				where: (metadata) => eq(metadata.id, urlHash),
			});

			if (existingMetadata) {
				reply.code(200);
				reply.send(existingMetadata);
				return;
			}

			await queues["url-metadata"].add(urlHash, {
				...request.body,
				url: normalizedUrl,
			});

			reply.code(202);
		},
	);
};

export default urlMetadataRoutes;
