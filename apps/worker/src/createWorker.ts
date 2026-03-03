import { Worker } from "bullmq";
import type { TasksValues } from "@playfulprogramming/bullmq";
import { redis } from "@playfulprogramming/redis";

export function createWorker<T extends TasksValues>(
	task: T,
	processor: string,
): Worker {
	const processorFile = import.meta
		.resolve(processor)
		.replace(/^file:\/\//, "");
	const worker = new Worker(task, processorFile, {
		connection: redis as never,
		concurrency: 2,
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

	return worker;
}
