import { processImages } from "./utils/processImage.ts";
import { getVideoDataFromUrl } from "./data-providers/video.ts";
import { type EmbedData, BUCKET } from "./common.ts";
export { videoHosts } from "./data-providers/video.ts";
import { visit } from "unist-util-visit";
import type { Element } from "hast";
import { fromHtml } from "hast-util-from-html";

function getIFrameAttributes(html: string) {
	const tree = fromHtml(html);

	let properties = {} as Record<string, unknown>;
	visit(tree, { tagName: "iframe" }, (_node) => {
		if (!_node) return;
		const node: Element = _node;
		properties = node.properties;
	});

	return properties;
}

export async function getEmbedDataFromVideo(
	jobId: string,
	inputUrl: URL,
	signal: AbortSignal,
): Promise<EmbedData> {
	let error = false;

	const videoData = await getVideoDataFromUrl(inputUrl).catch((e) => {
		console.error(`Unable to fetch video data for ${inputUrl}`, e);
		error = true;
		return undefined;
	});

	const expectedThumbnailWidth = videoData?.thumbnail_width ?? 1024;

	const banner = videoData?.thumbnail_url
		? await processImages(
				[new URL(videoData.thumbnail_url)],
				expectedThumbnailWidth,
				BUCKET,
				"remote-video-thumbnail",
				jobId,
				signal,
			).catch((e) => {
				console.error(`Unable upload thumbnail image for ${inputUrl}`, e);
				error = true;
				return undefined;
			})
		: undefined;

	let embedSrc: string | undefined = undefined;
	let embedWidth: number | undefined = undefined;
	let embedHeight: number | undefined = undefined;
	if (videoData?.html) {
		const attributes = getIFrameAttributes(videoData.html);
		if (attributes.src) embedSrc = String(attributes.src);
		const width = Number(attributes.width);
		const height = Number(attributes.height);
		if (isFinite(width)) embedWidth = width;
		if (isFinite(height)) embedHeight = height;
	}

	return {
		title: videoData?.title,
		banner,
		embedSrc,
		embedWidth,
		embedHeight,
		error,
	};
}
