import type { Job } from "bullmq";
import { Worker } from "bullmq";
import {
	type TaskInputs,
	redis,
	type TasksValues,
} from "@playfulprogramming/common";

export function createWorker<T extends TasksValues>(
	task: T,
	callback: (job: Job<TaskInputs[T]>) => Promise<void>,
): Worker {
	return new Worker(
		task,
		async (job) => {
			const result = await callback(job);
			console.log(`Completed job ${job.id}:`, result);
			return result;
		},
		{ connection: redis },
	);
}
