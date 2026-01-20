import { createHealthcheck } from "./createHealthcheck.ts";
import { createWorker } from "./createWorker.ts";
import { Tasks } from "@playfulprogramming/common";

createWorker(Tasks.POST_IMAGES, "./tasks/post-images/processor.ts");
createWorker(Tasks.URL_METADATA, "./tasks/url-metadata/processor.ts");
createWorker(Tasks.SYNC_AUTHOR, "./tasks/sync-author/processor.ts");
createWorker(Tasks.SYNC_COLLECTION, "./tasks/sync-collection/processor.ts");
createWorker(Tasks.SYNC_POST, "./tasks/sync-post/processor.ts");
createHealthcheck();
