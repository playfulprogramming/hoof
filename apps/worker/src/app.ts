import { processUrlMetadata } from "./tasks/url-metadata/processor.ts";
import { createWorker } from "./createWorker.ts";
import { Tasks } from "@playfulprogramming/common";

createWorker(Tasks.URL_METADATA, processUrlMetadata);
