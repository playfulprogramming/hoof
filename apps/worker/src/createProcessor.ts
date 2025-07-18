import type {
	TasksValues,
	TaskOutputs,
	TaskInputs,
} from "@playfulprogramming/common";
import type { Job, Processor } from "bullmq";
import { setTimeout } from "timers/promises";

process.on("uncaughtException", function (err) {
	console.error(err, "Uncaught exception");
});

process.on("unhandledRejection", (reason, promise) => {
	console.error({ promise, reason }, "Unhandled Rejection at: Promise");
});

const JOB_TIMEOUT = 2 * 60 * 1000;

type TaskContext = {
	signal: AbortSignal;
};

type TaskProcessor<T extends TasksValues> = (
	job: Job<TaskInputs[T]>,
	context: TaskContext,
) => Promise<TaskOutputs[T]>;

export function createProcessor<T extends TasksValues>(
	_task: T,
	processor: TaskProcessor<T>,
): Processor<TaskInputs[T], TaskOutputs[T]> {
	return async (job) => {
		const controller = new AbortController();
		try {
			const result = await Promise.race([
				processor(job, { signal: controller.signal }),
				setTimeout(JOB_TIMEOUT, { signal: controller.signal }).then(
					() => "timeout" as const,
				),
			]);

			if (result === "timeout") {
				throw new Error(`Reached job timeout after ${JOB_TIMEOUT}ms`);
			} else {
				return result;
			}
		} finally {
			controller.abort();
		}
	};
}
