import fp from "fastify-plugin";
import { Queue } from "bullmq";
import IORedis from "ioredis";

interface JobQueue {
  urlMetadata: Queue<{ url: string }>;
}

declare module "fastify" {
  interface FastifyInstance {
    jobQueue: JobQueue;
  }
}

function createConnection() {
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3
  });
}

export default fp(async (fastify) => {
  const connection = createConnection();

  const urlMetadata = new Queue("url-metadata", { connection });

  fastify.decorate("jobQueue", {
    urlMetadata
  });

  fastify.addHook("onClose", async () => {
    await urlMetadata.close();
    await connection.quit();
  });
}, {
  name: "jobQueue"
});
