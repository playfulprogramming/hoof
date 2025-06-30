import { Queue, QueueEvents } from "bullmq";
import {
	type TasksValues,
	type TaskInputs,
	type TaskOutputs,
	Tasks,
} from "@playfulprogramming/common";
import { redis } from "@playfulprogramming/redis";

type Queues = { [T in TasksValues]: Queue<TaskInputs[T], TaskOutputs[T]> };

function createQueues(): Queues {
	const queues: Record<TasksValues, unknown> = {} as never;
	for (const task of Object.values(Tasks)) {
		queues[task] = new Queue(task, {
			connection: redis,
			defaultJobOptions: {
				attempts: 3,
				backoff: {
					type: "exponential",
					delay: 1000,
				},
			},
		});
	}
	return queues as Queues;
}

type QueueEventsRecord = { [T in TasksValues]: QueueEvents };

function createQueueEvents(): QueueEventsRecord {
	const queueEvents: Record<TasksValues, QueueEvents> = {} as never;
	for (const task of Object.values(Tasks)) {
		queueEvents[task] = new QueueEvents(task, { connection: redis });
	}
	return queueEvents as QueueEventsRecord;
}

export const queues = createQueues();
export const queueEvents = createQueueEvents();

export function createJob<T extends TasksValues>(
	task: T,
	id: string,
	data: TaskInputs[T],
) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const queue = queues[task] as Queue<any>;
	queue.add(id, data, {
		deduplication: {
			id: id,
		},
	});
}
