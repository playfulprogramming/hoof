import { URL } from "url";
import { fetchPageHtml, getOpenGraphImage, getPageTitle } from "./fetch-page-html";
import { fetchPageIcon } from "./fetch-page-icon";
import { imageToS3 } from "./image-to-s3";
import { Queue, Worker, QueueScheduler } from "bullmq";
import IORedis from "ioredis";
import { createQueueConnection, createWorkerConnection } from "../redis";
import { FastifyInstance } from "fastify";
import { createApp } from "../../api/src/app";

interface UrlMetadataInput {
	url: string;
}

interface UrlMetadataOutput {
	title?: string;
	icon?: string;
	banner?: string;
}

const queueConnection = createQueueConnection();
const workerConnection = createWorkerConnection();

const urlMetadataQueue = new Queue<UrlMetadataInput>("url-metadata", { 
    connection: queueConnection 
});

new QueueScheduler("url-metadata", { 
    connection: new IORedis(process.env.REDIS_URL) // Scheduler needs its own connection
});

let app: FastifyInstance;

// Initialize Fastify instance to use plugins
async function initApp() {
  if (!app) {
    app = await createApp();
    await app.ready();
  }
  return app;
}

function handleError(name: string): (e: Error) => undefined {
	return (e) => {
		console.error(`Error in ${name}:`, e);
		return undefined;
	};
}

async function processUrlMetadataJob(job: { data: UrlMetadataInput }): Promise<UrlMetadataOutput> {
	const fastify = await initApp();
	const BUCKET = await fastify.s3.createBucket(process.env.S3_BUCKET);

	const inputUrl = new URL(job.data.url);
	const root = await fetchPageHtml(inputUrl);
	if (!root) throw Error("Unable to fetch page HTML");

	const title = getPageTitle(root);

	const tags = {
		origin: inputUrl.origin,
		page: inputUrl.href,
	};

	const iconPromise = fetchPageIcon(inputUrl, root)
		.then(url => imageToS3(url, 24, BUCKET, "remote-icon", { from: "url-metadata/icon", url: url.href, ...tags }))
		.catch(handleError("fetchPageIcon"));

	const bannerPromise = getOpenGraphImage(inputUrl, root)
		.then(url => imageToS3(url, 896, BUCKET, "remote-banner", { from: "url-metadata/banner", url: url.href, ...tags }))
		.catch(handleError("getOpenGraphImage"));

	const [icon, banner] = await Promise.all([iconPromise, bannerPromise]);

	return {
		title,
		banner,
		icon,
	};
}

new Worker("url-metadata", processUrlMetadataJob, { 
    connection: workerConnection,
    concurrency: 5
});

export async function addUrlMetadataTask(input: UrlMetadataInput) {
	await urlMetadataQueue.add("url-metadata-job", input);
}
