import { Queue } from "bullmq";
import { redis } from "@playfulprogramming/redis";
import { env } from "@playfulprogramming/common";
import {
	type TasksValues,
	type TaskInputs,
	type QueueValues,
	Queues,
	type QueueInputs,
} from "./tasks/index.ts";

type Queues = { [Q in QueueValues]?: Queue<QueueInputs[Q]> };

const queues: Queues = {};

export function createQueue<Q extends QueueValues>(
	queue: Q,
): Queue<QueueInputs[Q]> {
	const existingQueue = queues[queue];
	if (existingQueue) return existingQueue;

	const newQueue: Queue<QueueInputs[Q]> = new Queue(queue, {
		connection: redis,
		prefix: env.BULLMQ_PREFIX,
		defaultJobOptions: {
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
		},
	});

	queues[queue] = newQueue as never;
	return newQueue;
}

export async function createJob<T extends TasksValues>(
	task: T,
	id: string,
	data: TaskInputs[T],
	opts?: { delay?: number },
) {
	const queue = createQueue(Queues.WORKER);
	const jobId = `${task}:${id}`;
	await queue.add(
		jobId,
		{
			task,
			data,
		},
		{
			deduplication: {
				id: jobId,
			},
			delay: opts?.delay,
		},
	);
}
