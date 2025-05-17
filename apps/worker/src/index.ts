import { processUrlMetadata } from "./tasks/url-metadata/processor.ts";
import { createWorker } from "./createWorker.ts";
import { Tasks } from "@playfulprogramming/common";

process.on("uncaughtException", function (err) {
	console.error(err, "Uncaught exception");
});

process.on("unhandledRejection", (reason, promise) => {
	console.error({ promise, reason }, "Unhandled Rejection at: Promise");
});

createWorker(Tasks.URL_METADATA, processUrlMetadata);
