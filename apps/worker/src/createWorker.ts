import { Worker, type Processor } from "bullmq";
import type {
	TaskInputs,
	TaskOutputs,
	TasksValues,
} from "@playfulprogramming/common";
import { redis } from "@playfulprogramming/redis";

export function createWorker<T extends TasksValues>(
	task: T,
	processor: Processor<TaskInputs[T], TaskOutputs[T]>,
): Worker {
	const worker = new Worker(task, processor, {
		connection: redis,
		concurrency: 2,
		removeOnComplete: { count: 1000 },
		removeOnFail: { count: 5000 },
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
