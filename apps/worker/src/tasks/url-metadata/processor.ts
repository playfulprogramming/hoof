import { URL } from "url";

import {
	fetchPageHtml,
	getOpenGraphImage,
	getPageTitle,
} from "./utils/fetchPageHtml.ts";
import { fetchPageIcon } from "./utils/fetchPageIcon.ts";
import { processImage } from "./utils/processImage.ts";
import { type UrlMetadataInput, s3 } from "@playfulprogramming/common";
import { db, urlMetadata } from "@playfulprogramming/db";

export async function processUrlMetadata(job: {
	id?: string;
	data: UrlMetadataInput;
}): Promise<void> {
	const BUCKET = await s3.createBucket(process.env.S3_BUCKET);

	const inputUrl = new URL(job.data.url);
	const root = await fetchPageHtml(inputUrl);
	if (!root) throw Error("Unable to fetch page HTML");

	const title = getPageTitle(root);

	const iconPromise = fetchPageIcon(inputUrl, root)
		.then((url) => processImage(url, 24, BUCKET, "remote-icon", job.id))
		.catch((e) => {
			console.error(e, "Error processing icon");
			return undefined;
		});

	const bannerPromise = getOpenGraphImage(root, inputUrl)
		.then((url) => processImage(url, 896, BUCKET, "remote-banner", job.id))
		.catch((e) => {
			console.error(e, "Error processing banner");
			return undefined;
		});

	const [icon, banner] = await Promise.all([iconPromise, bannerPromise]);

	console.log("Storing url_metadata...");
	await db.insert(urlMetadata).values({
		url: inputUrl.href,
		title,
		icon,
		banner,
	});
	console.log("Done");
}
