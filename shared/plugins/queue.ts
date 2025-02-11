import fp from "fastify-plugin";
import { Queue } from "bullmq";

declare module "fastify" {
    interface FastifyInstance {
        queue: {
            create<T>(name: string): Queue<T>;
            get<T>(name: string): Queue<T> | undefined;
        }
    }
}

const QUEUE_NAMES = [
    "url-metadata"
]

export default fp(async (fastify) => {
    const queues = new Map<string, Queue>();

    for (const name of QUEUE_NAMES) {
        queues.set(name, new Queue(name, {
            connection: fastify.redis.primary
        }));
    }

    fastify.decorate("queue", {
        create: <T>(name: string) => {
            const queue = queues.get(name);
            if (queue) return queue as Queue<T>;

            queues.set(name, new Queue(name, {
                connection: fastify.redis.primary
            }));

            return queues.get(name) as Queue<T>;
        },
        get: <T>(name: string) => queues.get(name) as Queue<T> | undefined
    });

    fastify.addHook("onClose", async () => {
        await Promise.all([...queues.values()].map(q => q.close()));
        queues.clear();
    });
}, {
    name: "queue",
    dependencies: ["redis"]
});
