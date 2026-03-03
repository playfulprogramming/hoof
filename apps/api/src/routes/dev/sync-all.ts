import type { FastifyPluginAsync } from "fastify";
import { Tasks, createJob } from "@playfulprogramming/bullmq";

const syncAllRoute: FastifyPluginAsync = async (fastify) => {
	fastify.post<{
		Body: object;
		Reply: string;
	}>(
		"/development/sync-all",
		{
			schema: {
				description: "Spawns tasks to sync all posts and authors to the db",
			},
		},
		async (_request, reply) => {
			await createJob(Tasks.SYNC_ALL, "sync-all", { ref: "main" });
			reply.code(200);
		},
	);
};

export default syncAllRoute;
