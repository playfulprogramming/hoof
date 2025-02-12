import { FastifyPluginAsync } from "fastify";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { UrlMetadataInput, UrlMetadataInputSchema } from "src/shared_lib/types";

const urlMetadataRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{ Body: UrlMetadataInput }>(
		"/url-metadata",
		{
			schema: {
				body: UrlMetadataInputSchema,
			},
		},
		async (request, reply) => {
			try {
				// Normalize URL
				const inputUrl = new URL(request.body.url);
				const normalizedUrl = new URL(
					inputUrl.pathname,
					`${inputUrl.protocol}//${inputUrl.host.toLowerCase()}`,
				).toString();

				const urlHash = createHash("md5").update(normalizedUrl).digest("hex");

				const existingMetadata =
					await fastify.db.query.urlMetadataInDB.findFirst({
						where: (metadata) => eq(metadata.id, urlHash),
					});

				const queue = fastify.queue.get("url-metadata");
				await queue.add(urlHash, {
					...request.body,
					url: normalizedUrl,
				});

				reply.code(202);
			} catch (err) {
				fastify.log.error(err);
				reply.internalServerError();
			}
		},
	);
};

export default urlMetadataRoutes;
