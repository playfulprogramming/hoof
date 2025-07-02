import { createWorker } from "./createWorker.ts";
import { Tasks } from "@playfulprogramming/common";

createWorker(Tasks.POST_IMAGES, "./tasks/post-images/processor.ts");
createWorker(Tasks.URL_METADATA, "./tasks/url-metadata/processor.ts");
