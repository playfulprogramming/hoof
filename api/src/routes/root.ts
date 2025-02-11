import { FastifyPluginAsync } from "fastify";

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
	fastify.get("/", async function (_request, reply) {
		reply.status(200);
	});
};

export default root;
