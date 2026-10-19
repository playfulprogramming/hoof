import type { QueueInputs, TasksValues } from "@playfulprogramming/bullmq";
import type { TaskWrapper } from "../createProcessor.ts";
import { type Processor } from "bullmq";
import { setTimeout } from "timers/promises";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tasks = new Map<TasksValues, TaskWrapper<any>>();

{
	const processors = [
		(await import("../tasks/cleanup-attachments/processor.ts")).default,
		(await import("../tasks/delete-s3-object/processor.ts")).default,
		(await import("../tasks/grant-author-achievements/processor.ts")).default,
		(await import("../tasks/post-images/processor.ts")).default,
		(await import("../tasks/sync-all/processor.ts")).default,
		(await import("../tasks/sync-author/processor.ts")).default,
		(await import("../tasks/sync-collection/processor.ts")).default,
		(await import("../tasks/sync-post/processor.ts")).default,
		(await import("../tasks/url-metadata/processor.ts")).default,
		(await import("../tasks/webhook/installation.ts")).default,
		(await import("../tasks/webhook/pull-request.ts")).default,
		(await import("../tasks/webhook/push.ts")).default,
	];

	for (const processor of processors) {
		tasks.set(processor.task, processor);
	}
}

const JOB_TIMEOUT = 2 * 60 * 1000;

const processor: Processor<QueueInputs["worker"]> = async (
	job,
	_token,
	jobSignal,
) => {
	const processor = tasks.get(job.data.task);
	if (processor === undefined)
		throw new Error(`Could not locate the processor for task ${job.data.task}`);

	const controller = new AbortController();
	const signal = jobSignal
		? AbortSignal.any([jobSignal, controller.signal])
		: controller.signal;

	const processorJob = {
		id: job.id,
		data: job.data.data,
		signal,
	};

	try {
		const result = await Promise.race([
			processor(processorJob),
			setTimeout(JOB_TIMEOUT, { signal }).then(() => "timeout" as const),
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

process.on("uncaughtException", function (err) {
	console.error(err, "Uncaught exception");
});

process.on("unhandledRejection", (reason, promise) => {
	console.error({ promise, reason }, "Unhandled Rejection at: Promise");
});

export default processor;
