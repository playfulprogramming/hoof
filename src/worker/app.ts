import AutoLoad from "@fastify/autoload";
import { FastifyPluginAsync } from "fastify";
import { Worker } from "bullmq";
import { processUrlMetadata } from "./tasks/url-metadata/processor.ts";

const worker: FastifyPluginAsync = async (fastify): Promise<void> => {
	// Load shared plugins (redis, s3, queue, etc.)
	void fastify.register(AutoLoad, {
		dir: "../../shared/plugins",
	});

	fastify.addHook("onReady", async () => {
		const urlWorker = new Worker(
			"url-metadata",
			(job) => processUrlMetadata(job, fastify),
			{ connection: fastify.redis.primary },
		);

		fastify.addHook("onClose", async () => {
			await urlWorker.close();
		});
	});
};

export default worker;
