import { FastifyInstance } from "fastify";
import { URL } from "url";

import {
	fetchPageHtml,
	getOpenGraphImage,
	getPageTitle,
} from "./utils/html.ts";
import { fetchPageIcon } from "./utils/icons.ts";
import { processImage } from "./utils/images.ts";
import {
	UrlMetadataInput,
	UrlMetadataOutput,
} from "src/shared_lib/types/url-metadata.ts";

export async function processUrlMetadata(
	job: { data: UrlMetadataInput },
	fastify: FastifyInstance,
): Promise<UrlMetadataOutput> {
	const BUCKET = await fastify.s3.createBucket(fastify.env.S3_BUCKET);

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
			processImage(
				url,
				24,
				BUCKET,
				"remote-icon",
				{
					from: "url-metadata/icon",
					url: url.href,
					...tags,
				},
				fastify,
			),
		)
		.catch((e) => {
			fastify.log.error(e, "Error processing icon");
			return undefined;
		});

	const bannerPromise = getOpenGraphImage(root, inputUrl)
		.then((url) =>
			processImage(
				url,
				896,
				BUCKET,
				"remote-banner",
				{
					from: "url-metadata/banner",
					url: url.href,
					...tags,
				},
				fastify,
			),
		)
		.catch((e) => {
			fastify.log.error(e, "Error processing banner");
			return undefined;
		});

	const [icon, banner] = await Promise.all([iconPromise, bannerPromise]);

	return { title, icon, banner };
}
