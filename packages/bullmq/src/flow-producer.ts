import { env } from "@playfulprogramming/common";
import { redis } from "@playfulprogramming/redis";
import { type FlowJobNode, FlowProducer } from "bullmq";
import { Queues, type TaskInputs, type TasksValues } from "./tasks/types.ts";

export const flowProducer = new FlowProducer({
	connection: redis,
	prefix: env.BULLMQ_PREFIX,
});

export function createFlowJobNode<T extends TasksValues>(opts: {
	task: T;
	name: string;
	data: TaskInputs[T];
	children?: FlowJobNode[];
}): FlowJobNode {
	const jobId = `${opts.task}:${opts.name}`;
	return {
		name: jobId,
		data: {
			task: opts.task,
			data: opts.data,
		},
		queueName: Queues.WORKER,
		children: opts.children,
	};
}
