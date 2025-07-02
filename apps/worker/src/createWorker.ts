import { Worker } from "bullmq";
import type { TasksValues } from "@playfulprogramming/common";
import { redis } from "@playfulprogramming/redis";

export function createWorker<T extends TasksValues>(
	task: T,
	processor: string,
): Worker {
	const processorFile = import.meta
		.resolve(processor)
		.replace(/^file:\/\//, "");
	const worker = new Worker(task, processorFile, {
		connection: redis,
		concurrency: 2,
		removeOnComplete: { count: 1000 },
		removeOnFail: { count: 5000 },
		useWorkerThreads: true,
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

	return worker;
}
