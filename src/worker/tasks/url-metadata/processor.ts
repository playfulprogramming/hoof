import { URL } from "url";

import {
	fetchPageHtml,
	getOpenGraphImage,
	getPageTitle,
} from "./utils/html.ts";
import { fetchPageIcon } from "./utils/icons.ts";
import { processImage } from "./utils/images.ts";
import { UrlMetadataInput } from "src/common/tasks/url-metadata.ts";
import { createBucket } from "src/common/s3/client.ts";
import { db } from "src/db/client.ts";
import { urlMetadata } from "src/db/schema/url-metadata.ts";

export async function processUrlMetadata(job: {
	data: UrlMetadataInput;
}): Promise<void> {
	const BUCKET = await createBucket(process.env.S3_BUCKET);

	const inputUrl = new URL(job.data.url);
	const root = await fetchPageHtml(inputUrl);
	if (!root) throw Error("Unable to fetch page HTML");

	const title = getPageTitle(root);
	const tags = {
		origin: inputUrl.origin,
		page: inputUrl.href,
	};

	const iconPromise = fetchPageIcon(inputUrl, root)
		.then((url) =>
			processImage(url, 24, BUCKET, "remote-icon", {
				from: "url-metadata/icon",
				url: url.href,
				...tags,
			}),
		)
		.catch((e) => {
			console.error(e, "Error processing icon");
			return undefined;
		});

	const bannerPromise = getOpenGraphImage(root, inputUrl)
		.then((url) =>
			processImage(url, 896, BUCKET, "remote-banner", {
				from: "url-metadata/banner",
				url: url.href,
				...tags,
			}),
		)
		.catch((e) => {
			console.error(e, "Error processing banner");
			return undefined;
		});

	const [icon, banner] = await Promise.all([iconPromise, bannerPromise]);

	await db
		.insert(urlMetadata)
		.values({
			url: inputUrl.href,
			title,
			icon,
			banner,
		})
		.execute();
}
