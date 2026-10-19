import type {
	TasksValues,
	TaskOutputs,
	TaskInputs,
} from "@playfulprogramming/bullmq";

process.on("uncaughtException", function (err) {
	console.error(err, "Uncaught exception");
});

process.on("unhandledRejection", (reason, promise) => {
	console.error({ promise, reason }, "Unhandled Rejection at: Promise");
});

type TaskJob<D> = {
	id?: string;
	data: D;
	signal: AbortSignal;
};

type TaskProcessor<T extends TasksValues> = (
	job: TaskJob<TaskInputs[T]>,
) => Promise<TaskOutputs[T]>;

export type TaskWrapper<T extends TasksValues> = TaskProcessor<T> & {
	task: T;
};

export function createProcessor<T extends TasksValues>(
	task: T,
	processor: TaskProcessor<T>,
): TaskWrapper<T> {
	const run: TaskWrapper<T> = async function run(job) {
		return await processor(job);
	};
	run.task = task;
	return run;
}
