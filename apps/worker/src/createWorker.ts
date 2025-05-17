import type { Job } from "bullmq";
import { Worker } from "bullmq";
import {
	type TaskInputs,
	redis,
	type TasksValues,
} from "@playfulprogramming/common";

const JOB_TIMEOUT = 60 * 1000;

export function createWorker<T extends TasksValues>(
	task: T,
	callback: (job: Job<TaskInputs[T]>, signal: AbortSignal) => Promise<void>,
): Worker {
	const worker = new Worker(
		task,
		async (job) => {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), JOB_TIMEOUT);

			try {
				await callback(job, controller.signal);
			} finally {
				clearTimeout(timer);
			}
		},
		{ connection: redis, concurrency: 16 },
	);

	worker.on("completed", (job) => {
		console.info("Job completed:", {
			id: job.id,
			data: job.data,
			returnvalue: job.returnvalue,
		});
	});

	worker.on("failed", (job) => {
		console.error(
			"Job failed:",
			{ id: job?.id, data: job?.data },
			job?.stacktrace,
		);
	});

	return worker;
}
