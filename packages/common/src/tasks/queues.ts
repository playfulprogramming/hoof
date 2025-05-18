import { Queue, QueueEvents } from "bullmq";
import {
	type TasksValues,
	type TaskInputs,
	type TaskOutputs,
	Tasks,
} from "./types.ts";
import { redis } from "../redis/client.ts";

type Queues = { [T in TasksValues]: Queue<TaskInputs[T], TaskOutputs[T]> };

function createQueues(): Queues {
	const queues: Record<TasksValues, unknown> = {} as never;
	for (const task of Object.values(Tasks)) {
		queues[task] = new Queue(task, { connection: redis });
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
