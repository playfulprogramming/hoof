import { Queue } from "bullmq";
import { TaskInputs, Tasks } from "./index.ts";
import { redis } from "../redis/client.ts";

type Queues = { [T in Tasks]: Queue<TaskInputs[T]> };

function createQueues(): Queues {
	const queues: Record<Tasks, unknown> = {} as never;
	for (const task of Object.values(Tasks)) {
		queues[task] = new Queue(task, { connection: redis });
	}
	return queues as Queues;
}

export const queues = createQueues();
