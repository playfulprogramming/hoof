import fp from "fastify-plugin";
import { Queue } from "bullmq";

declare module "fastify" {
	interface FastifyInstance {
		queue: {
			get<T>(name: string): Queue<T>;
		};
	}
}

const QUEUE_NAMES = ["url-metadata"];

export default fp(
	async (fastify) => {
		const queues = new Map<string, Queue>();

		for (const name of QUEUE_NAMES) {
			queues.set(
				name,
				new Queue(name, {
					connection: fastify.redis.primary,
				})
			);
		}

		fastify.decorate("queue", {
			get: <T>(name: string) => {
				const queue = queues.get(name);
				if (!queue) {
					throw new Error(
						`Queue "${name}" not found. Valid queues are: ${QUEUE_NAMES.join(
							", "
						)}`
					);
				}
				return queue as Queue<T>;
			},
		});

		fastify.addHook("onClose", async () => {
			await Promise.all([...queues.values()].map((queue) => queue.close()));
			queues.clear();
		});
	},
	{
		name: "queue",
		dependencies: ["redis"],
	}
);
