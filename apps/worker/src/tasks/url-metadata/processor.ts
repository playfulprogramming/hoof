import { URL } from "url";

import {
	fetchPageHtml,
	getOpenGraphImage,
	getPageTitle,
} from "./utils/fetchPageHtml.ts";
import { fetchPageIcon } from "./utils/fetchPageIcon.ts";
import { processImage } from "./utils/processImage.ts";
import {
	type UrlMetadataInput,
	type UrlMetadataOutput,
	s3,
} from "@playfulprogramming/common";
import { db, urlMetadata } from "@playfulprogramming/db";
import { RobotDeniedError } from "../../utils/fetchAsBot.ts";

export async function processUrlMetadata(job: {
	id?: string;
	data: UrlMetadataInput;
}): Promise<UrlMetadataOutput> {
	const BUCKET = await s3.createBucket(process.env.S3_BUCKET);

	let error: boolean = false;
	const inputUrl = new URL(job.data.url);
	const root = await fetchPageHtml(inputUrl).catch((e) => {
		console.error(`Unable to fetch HTML for ${inputUrl}`, e);
		if (e! instanceof RobotDeniedError) {
			error = true;
		}
		return undefined;
	});

	const title = root && getPageTitle(root);

	const iconPromise =
		root &&
		fetchPageIcon(inputUrl, root)
			.then(
				(url) => url && processImage(url, 24, BUCKET, "remote-icon", job.id),
			)
			.catch((e) => {
				console.error(`Unable to fetch icon for ${inputUrl}`, e);
				error = true;
				return undefined;
			});

	const bannerPromise =
		root &&
		getOpenGraphImage(root, inputUrl)
			.then(
				(url) => url && processImage(url, 896, BUCKET, "remote-banner", job.id),
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
	await db.insert(urlMetadata).values(result);
	return result;
}
