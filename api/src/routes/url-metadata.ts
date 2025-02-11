import { FastifyInstance } from "fastify";
import { addUrlMetadataTask } from "../../../worker/src/url-metadata/task";

export default async function urlMetadataRoutes(fastify: FastifyInstance) {
	fastify.post<{ Body: { url: string } }>("/url-metadata", async (request, reply) => {
		const { url } = request.body;
		try {
			await addUrlMetadataTask({ url });
			reply.send({ status: "Job submitted successfully" });
		} catch (error) {
			reply.status(500).send({ error: "Failed to submit job" });
		}
	});
}
