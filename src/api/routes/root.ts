import { FastifyPluginAsync } from "fastify";

const root: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
	fastify.get("/", async function (_request, reply) {
		reply.status(200);
	});
};

export default root;
