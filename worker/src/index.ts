import { S3 } from "./s3";
import sql from "./sql";
import { urlMetadataTask } from "./url-metadata/task";
import { setTimeout } from "node:timers/promises";
import faktory from 'faktory-worker';
import { UrlMetadataInput } from "./url-metadata/types";

const VERBOSE = true;

async function taskBegin(task: string, id: string) {
	if (VERBOSE) {
		console.log(`Begin task: ${task} / ${id}`);
	}
}

async function taskEnd(task: string, id: string, result: any) {
	if (VERBOSE) {
		console.log(`End task: ${task} / ${id}`, result);
	}

	await sql.begin(async tx => {
		await tx.prepare(`INSERT INTO TaskResults (task, id, output)
               VALUES (${task}, ${id}, ${result})`);
	})
}

try {
	faktory.register("url-metadata", (...args) => async ({ job }) => {
		// @ts-ignore
		const jobData = args as UrlMetadataInput;
		const id = job.id;
		const taskName = "url-metadata"

		await taskBegin(taskName, id);

		const result = await urlMetadataTask(jobData)

		await taskEnd(taskName, id, result);
	});

	await faktory.work();
} finally {
	console.log("Closing sql connection...");
	await sql.end();
	S3.destroy();

	console.log("Exiting...");
}