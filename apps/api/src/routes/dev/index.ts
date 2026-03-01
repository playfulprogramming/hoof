import { type FastifyPluginAsync } from "fastify";
import syncAllRoute from "./sync-all.ts";

const devRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.register(syncAllRoute);
};

export default devRoutes;
