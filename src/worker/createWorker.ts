import { Job, Worker } from "bullmq";
import { TaskInputs, Tasks } from "src/common/tasks/index.ts";
import { redis } from "../common/redis/client.ts";

export function createWorker<T extends Tasks>(
	task: T,
	callback: (job: Job<TaskInputs[T]>) => Promise<void>,
): Worker {
	return new Worker(task, callback, { connection: redis });
}
