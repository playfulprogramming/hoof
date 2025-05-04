import { Job, Worker } from "bullmq";
import { TaskInputs, redis, TasksValues } from "@playfulprogramming/common";

export function createWorker<T extends TasksValues>(
	task: T,
	callback: (job: Job<TaskInputs[T]>) => Promise<void>,
): Worker {
	return new Worker(task, callback, { connection: redis });
}
