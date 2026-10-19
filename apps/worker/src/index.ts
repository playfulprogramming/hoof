import { createHealthcheck } from "./createHealthcheck.ts";
import { createWorker } from "./createWorker.ts";
import { Queues, Tasks, createQueue } from "@playfulprogramming/bullmq";

createWorker(Queues.WORKER, "./queues/worker.ts");
createHealthcheck();

// Repeatable job: BullMQ dedupes repeatable schedulers by name + repeat
// options, so re-registering this on every worker restart is a no-op rather
// than creating duplicate schedules.
const CLEANUP_ATTACHMENTS_INTERVAL_MS = 24 * 60 * 60 * 1000;

createQueue(Queues.WORKER)
	.upsertJobScheduler(
		Tasks.CLEANUP_ATTACHMENTS,
		{
			every: CLEANUP_ATTACHMENTS_INTERVAL_MS,
		},
		{
			data: {
				task: Tasks.CLEANUP_ATTACHMENTS,
				data: {},
			},
		},
	)
	.catch((err) =>
		console.error("Failed to schedule cleanup-attachments job:", err),
	);
