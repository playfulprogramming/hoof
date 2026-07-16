import { createHealthcheck } from "./createHealthcheck.ts";
import { createWorker } from "./createWorker.ts";
import { Tasks, createQueue } from "@playfulprogramming/bullmq";

createWorker(Tasks.POST_IMAGES, "./tasks/post-images/processor.ts");
createWorker(Tasks.URL_METADATA, "./tasks/url-metadata/processor.ts");
createWorker(Tasks.SYNC_ALL, "./tasks/sync-all/processor.ts");
createWorker(Tasks.SYNC_AUTHOR, "./tasks/sync-author/processor.ts");
createWorker(Tasks.SYNC_COLLECTION, "./tasks/sync-collection/processor.ts");
createWorker(Tasks.SYNC_POST, "./tasks/sync-post/processor.ts");
createWorker(
	Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
	"./tasks/grant-author-achievements/processor.ts",
);
createWorker(
	Tasks.CLEANUP_ATTACHMENTS,
	"./tasks/cleanup-attachments/processor.ts",
);
createHealthcheck();

// Repeatable job: BullMQ dedupes repeatable schedulers by name + repeat
// options, so re-registering this on every worker restart is a no-op rather
// than creating duplicate schedules.
const CLEANUP_ATTACHMENTS_INTERVAL_MS = 24 * 60 * 60 * 1000;

createQueue(Tasks.CLEANUP_ATTACHMENTS)
	.add(
		Tasks.CLEANUP_ATTACHMENTS,
		{},
		{ repeat: { every: CLEANUP_ATTACHMENTS_INTERVAL_MS } },
	)
	.catch((err) =>
		console.error("Failed to schedule cleanup-attachments job:", err),
	);
