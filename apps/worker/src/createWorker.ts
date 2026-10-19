import { Worker } from "bullmq";
import type { QueueValues } from "@playfulprogramming/bullmq";
import { redis } from "@playfulprogramming/redis";
import { env } from "@playfulprogramming/common";

export function createWorker<Q extends QueueValues>(
	queue: Q,
	processor: string,
): Worker {
	const processorFile = new URL(import.meta.resolve(processor));
	const worker = new Worker(queue, processorFile, {
		connection: redis as never,
		prefix: env.BULLMQ_PREFIX,
		concurrency: 1,
		removeOnComplete: { count: 1000 },
		removeOnFail: { count: 5000 },
		useWorkerThreads: true,
		workerThreadsOptions: {
			// Workaround for https://github.com/taskforcesh/bullmq/issues/3699
			execArgv: [],
		},
	});

	worker.on("completed", (job) => {
		console.info("Job completed:", {
			id: job.id,
			data: job.data,
			returnvalue: job.returnvalue,
		});
	});

	worker.on("failed", (job) => {
		console.error(
			"Job failed:",
			{ id: job?.id, data: job?.data },
			job?.stacktrace,
		);
	});

	worker.on("stalled", (jobId) => {
		console.warn("Job stalled:", { queue, jobId });
	});

	return worker;
}
