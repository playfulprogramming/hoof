import { URL } from "url";
import { fetchPageHtml, getOpenGraphImage, getPageTitle } from "./fetch-page-html";
import { fetchPageIcon } from "./fetch-page-icon";
import { imageToS3 } from "./image-to-s3";
import { createBucket } from "src/s3";
import { UrlMetadataInput, UrlMetadataOutput } from "./types";

const BUCKET = await createBucket(process.env.S3_BUCKET);

function handleError(name: string): (e: Error) => undefined {
	return (e) => {
		console.error(`Error in ${name}:`, e);
		return undefined;
	};
}

export async function urlMetadataTask(input: UrlMetadataInput): Promise<UrlMetadataOutput> {
	const inputUrl = new URL(input.url);
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
