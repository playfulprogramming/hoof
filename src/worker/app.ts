import { processUrlMetadata } from "./tasks/url-metadata/processor.ts";
import { createWorker } from "src/worker/createWorker.ts";
import { Tasks } from "src/common/tasks/index.ts";

createWorker(Tasks.URL_METADATA, processUrlMetadata);
