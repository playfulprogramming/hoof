import { FastifyPluginAsync } from "fastify";

const rootRoute: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
	fastify.get("/", async function (_request, reply) {
		reply.status(200);
		reply.send("OK");
	});
};

export default rootRoute;
