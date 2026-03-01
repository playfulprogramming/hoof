import { createHealthcheck } from "./createHealthcheck.ts";
import { createWorker } from "./createWorker.ts";
import { Tasks } from "@playfulprogramming/bullmq";

createWorker(Tasks.POST_IMAGES, "./tasks/post-images/processor.ts");
createWorker(Tasks.URL_METADATA, "./tasks/url-metadata/processor.ts");
createWorker(Tasks.SYNC_ALL, "./tasks/sync-all/processor.ts");
createWorker(Tasks.SYNC_AUTHOR, "./tasks/sync-author/processor.ts");
createWorker(Tasks.SYNC_COLLECTION, "./tasks/sync-collection/processor.ts");
createWorker(Tasks.SYNC_POST, "./tasks/sync-post/processor.ts");
createHealthcheck();
