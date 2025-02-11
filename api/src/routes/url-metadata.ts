import { FastifyPluginAsync } from "fastify";
import { createHash } from "crypto";
import {
	UrlMetadataInput,
	UrlMetadataInputSchema,
} from "shared/types/url-metadata";

const urlMetadataRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{ Body: UrlMetadataInput }>(
		"/url-metadata",
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
				`${inputUrl.protocol}//${inputUrl.host.toLowerCase()}`
			).toString();

			const urlHash = createHash("md5").update(normalizedUrl).digest("hex");

			// TODO: Check if we've already processed this url before
			// We would check if there are any url-metadata jobs with this id (urlHash)
			// and if so, we would return the metadata.

			const queue = fastify.queue.get("url-metadata");
			if (!queue) {
				reply.code(500);
				return { error: "Queue not found" };
			}

			const job = await queue.add(urlHash, {
				...request.body,
				url: normalizedUrl,
			});

			reply.code(202);
			return { jobId: job.id };
		}
	);
};

export default urlMetadataRoutes;
