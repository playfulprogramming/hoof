import { createWorker } from "./createWorker.ts";
import { Tasks } from "@playfulprogramming/common";
import postImages from "./tasks/post-images/processor.ts";
import urlMetadata from "./tasks/url-metadata/processor.ts";

createWorker(Tasks.POST_IMAGES, postImages);
createWorker(Tasks.URL_METADATA, urlMetadata);
