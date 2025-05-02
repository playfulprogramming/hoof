import { Queue } from "bullmq";
import { TaskInputs, TaskInputsKeys, Tasks, TasksValues } from "./types.ts";
import { redis } from "../redis/client.ts";

type Queues = { [T in TaskInputsKeys]: Queue<TaskInputs[T]> };

function createQueues(): Queues {
	const queues: Record<TasksValues, unknown> = {} as never;
	for (const task of Object.values(Tasks)) {
		queues[task] = new Queue(task, { connection: redis });
	}
	return queues as Queues;
}

export const queues = createQueues();
