import { FastifyPluginAsync } from "fastify";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import {
	UrlMetadataInput,
	UrlMetadataInputSchema,
} from "src/common/tasks/url-metadata.ts";
import { db } from "src/db/client.ts";
import { queues } from "src/common/tasks/queues.ts";

const urlMetadataRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{ Body: UrlMetadataInput }>(
		"/tasks/url-metadata",
		{
			schema: {
				body: UrlMetadataInputSchema,
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
