import fp from "fastify-plugin";
import IORedis from "ioredis";

declare module "fastify" {
    interface FastifyInstance {
        redis: {
            primary: IORedis;
        }
    }
}

export default fp(async (fastify) => {
    const primaryConnection = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null
    });

    fastify.decorate("redis", {
        primary: primaryConnection,
    });

    fastify.addHook("onClose", async () => {
        await primaryConnection.quit();
    });
}, {
    name: "redis"
});
