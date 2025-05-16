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
	return new Worker(task, callback, { connection: redis });
}
