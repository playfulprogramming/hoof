import {
	fetchPageHtml,
	getOpenGraphImages,
	getPageTitle,
} from "./utils/fetchPageHtml.ts";
import { fetchPageIcons } from "./utils/fetchPageIcons.ts";
import { processImages } from "./utils/processImage.ts";
import { RobotDeniedError } from "../../utils/fetchAsBot.ts";
import { type EmbedData, BUCKET } from "./common.ts";

export async function getEmbedDataFromHtml(
	jobId: string,
	inputUrl: URL,
	signal: AbortSignal,
): Promise<EmbedData> {
	let error = false;

	const root = await fetchPageHtml(inputUrl, { signal }).catch((e) => {
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
		fetchPageIcons(inputUrl, root, signal)
			.then(
				(url) =>
					url && processImages(url, 24, BUCKET, "remote-icon", jobId, signal),
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
					url &&
					processImages(url, 896, BUCKET, "remote-banner", jobId, signal),
			)
			.catch((e) => {
				console.error(`Unable to fetch banner for ${inputUrl}`, e);
				error = true;
				return undefined;
			});

	const [icon, banner] = await Promise.all([iconPromise, bannerPromise]);

	return { title, icon, banner, error };
}
