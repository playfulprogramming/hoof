import { Tasks } from "@playfulprogramming/bullmq";
import { db, urlMetadata } from "@playfulprogramming/db";
import { createProcessor } from "../../createProcessor.ts";
import { type EmbedData } from "./common.ts";
import { getEmbedDataFromGist, gistHosts } from "./getEmbedDataFromGist.ts";
import { getEmbedDataFromHtml } from "./getEmbedDataFromHtml.ts";
import { getEmbedDataFromVideo, videoHosts } from "./getEmbedDataFromVideo.ts";
import { getEmbedDataFromPost, postHosts } from "./getEmbedDataFromPost.ts";

type UrlMetadataEmbedType = "gist" | "video" | "post";

export default createProcessor(Tasks.URL_METADATA, async (job, { signal }) => {
	const jobId = job.id;
	if (!jobId) throw new Error("Job ID is undefined!");
	const inputUrl = new URL(job.data.url);

	let embedPromise: Promise<EmbedData>;
	let embedType: UrlMetadataEmbedType | undefined = undefined;
	if (gistHosts.includes(inputUrl.hostname)) {
		embedType = "gist";
		embedPromise = getEmbedDataFromGist(inputUrl, signal);
	} else if (postHosts.includes(inputUrl.hostname)) {
		embedType = "post";
		embedPromise = getEmbedDataFromPost(jobId, inputUrl, signal);
	} else if (videoHosts.includes(inputUrl.hostname)) {
		embedType = "video";
		embedPromise = getEmbedDataFromVideo(jobId, inputUrl, signal);
	} else {
		embedPromise = getEmbedDataFromHtml(jobId, inputUrl, signal);
	}

	const embedData: EmbedData = await embedPromise.catch((e) => {
		console.error(`Error fetching embed data for '${inputUrl}'`, e);
		return { error: true };
	});

	const {
		icon,
		banner,
		title,
		embedSrc,
		embedWidth,
		embedHeight,
		gistId,
		postId,
		error,
	} = embedData;

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
		gistId,
		postId,
		embedSrc,
		embedWidth,
		embedHeight,
		embedType,
		fetchedAt: new Date(),
		error,
	};
	await db
		.insert(urlMetadata)
		.values(result)
		.onConflictDoUpdate({ target: urlMetadata.url, set: result });
	return result;
});
