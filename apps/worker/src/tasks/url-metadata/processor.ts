import { URL } from "url";

import {
	fetchPageHtml,
	getOpenGraphImages,
	getPageTitle,
} from "./utils/fetchPageHtml.ts";
import { fetchPageIcons } from "./utils/fetchPageIcons.ts";
import { processImages } from "./utils/processImage.ts";
import { Tasks, s3 } from "@playfulprogramming/common";
import { db, urlMetadata } from "@playfulprogramming/db";
import { RobotDeniedError } from "../../utils/fetchAsBot.ts";
import { createProcessor } from "../../createProcessor.ts";

export default createProcessor(Tasks.URL_METADATA, async (job) => {
	const BUCKET = await s3.createBucket(process.env.S3_BUCKET);

	let error: boolean = false;
	const inputUrl = new URL(job.data.url);
	const root = await fetchPageHtml(inputUrl).catch((e) => {
		console.error(`Unable to fetch HTML for ${inputUrl}`, e);
		if (!(e instanceof RobotDeniedError)) {
			error = true;
		}
		if (e instanceof DOMException && e.name === "TimeoutError") {
			throw e;
		}
		return undefined;
	});

	const title = root && getPageTitle(root);

	const iconPromise =
		root &&
		fetchPageIcons(inputUrl, root)
			.then(
				(url) => url && processImages(url, 24, BUCKET, "remote-icon", job.id),
			)
			.catch((e) => {
				console.error(`Unable to fetch icon for ${inputUrl}`, e);
				error = true;
				return undefined;
			});

	const bannerPromise =
		root &&
		getOpenGraphImages(root, inputUrl)
			.then(
				(url) =>
					url && processImages(url, 896, BUCKET, "remote-banner", job.id),
			)
			.catch((e) => {
				console.error(`Unable to fetch banner for ${inputUrl}`, e);
				error = true;
				return undefined;
			});

	const [icon, banner] = await Promise.all([iconPromise, bannerPromise]);

	console.log("Storing url_metadata...");
	const result = {
		url: inputUrl.href,
		title: title ?? null,
		iconKey: icon?.key ?? null,
		iconWidth: icon?.width ?? null,
		iconHeight: icon?.height ?? null,
		bannerKey: banner?.key ?? null,
		bannerWidth: banner?.width ?? null,
		bannerHeight: banner?.height ?? null,
		fetchedAt: new Date(),
		error,
	};
	await db
		.insert(urlMetadata)
		.values(result)
		.onConflictDoUpdate({ target: urlMetadata.url, set: result });
	return result;
});
