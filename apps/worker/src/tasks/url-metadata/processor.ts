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

export async function processUrlMetadata(job: {
	id?: string;
	data: UrlMetadataInput;
}): Promise<UrlMetadataOutput> {
	const BUCKET = await s3.createBucket(process.env.S3_BUCKET);

	const inputUrl = new URL(job.data.url);
	const root = await fetchPageHtml(inputUrl);
	if (!root) throw Error("Unable to fetch page HTML");

	const title = getPageTitle(root);

	const iconPromise = fetchPageIcon(inputUrl, root).then(
		(url) => url && processImage(url, 24, BUCKET, "remote-icon", job.id),
	);

	const bannerPromise = getOpenGraphImage(root, inputUrl).then(
		(url) => url && processImage(url, 896, BUCKET, "remote-banner", job.id),
	);

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
	};
	await db.insert(urlMetadata).values(result);
	return result;
}
