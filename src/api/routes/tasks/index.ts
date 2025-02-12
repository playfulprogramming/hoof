import { FastifyPluginAsync } from "fastify";
import urlMetadataRoutes from "./url-metadata.ts";

const tasks: FastifyPluginAsync = async (fastify) => {
	await fastify.register(urlMetadataRoutes, { prefix: "/tasks" });
};

export default tasks;
