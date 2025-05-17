import { Queue } from "bullmq";
import {
	type TaskInputs,
	type TaskInputsKeys,
	Tasks,
	type TasksValues,
} from "./types.ts";
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
