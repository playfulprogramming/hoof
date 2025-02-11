import { FastifyInstance } from "fastify";
import urlMetadataRoutes from "./url-metadata";

export default async function routes(fastify: FastifyInstance) {
	// ...existing code...
	await fastify.register(urlMetadataRoutes);
	// ...existing code...
}
