import { Queue } from "bullmq";
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

const queues = createQueues();

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
