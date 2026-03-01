import { Queue } from "bullmq";
import { redis } from "@playfulprogramming/redis";
import {
	type TasksValues,
	type TaskInputs,
	type TaskOutputs,
} from "./tasks/index.ts";

type Queues = { [T in TasksValues]?: Queue<TaskInputs[T], TaskOutputs[T]> };

const queues: Queues = {};

export function createQueue<T extends TasksValues>(
	task: T,
): Queue<TaskInputs[T], TaskOutputs[T]> {
	const existingQueue = queues[task];
	if (existingQueue) return existingQueue;

	const newQueue: Queue<TaskInputs[T], TaskOutputs[T]> = new Queue(task, {
		connection: redis,
		defaultJobOptions: {
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
		},
	});

	queues[task] = newQueue as never;
	return newQueue;
}

export function createJob<T extends TasksValues>(
	task: T,
	id: string,
	data: TaskInputs[T],
) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const queue = createQueue(task) as Queue<any>;
	queue.add(id, data, {
		deduplication: {
			id: id,
		},
	});
}
