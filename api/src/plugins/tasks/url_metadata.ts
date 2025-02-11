import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";

const urlMetadataPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.post<{ Body: { url: string } }>("/url-metadata", async (request, reply) => {
    const { url } = request.body;
    try {
      await fastify.jobQueue.urlMetadata.add("url-metadata-job", { url });
      reply.send({ status: "Job submitted successfully" });
    } catch (error) {
      reply.status(500).send({ error: "Failed to submit job" });
    }
  });
}, {
  name: "url-metadata",
  dependencies: ["jobQueue"]
});

export default urlMetadataPlugin;
