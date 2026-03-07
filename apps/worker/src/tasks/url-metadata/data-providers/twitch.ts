import { env } from "@playfulprogramming/common";

const parent = new URL(env.SITE_URL).hostname;

export interface TwitchOEmbedResponse {
	html: string;
	title: string;
	thumbnail_width?: number;
	thumbnail_url?: string;
}

// Twitch doesn't give us much without auth, so for now we're just getting the page metadata
export async function getTwitchOEmbedDataFromUrl(
	url: URL,
): Promise<TwitchOEmbedResponse> {
	// Fix issues with Twitch's iframe embed
	let embedUrl: URL | undefined;

	if (url.host === "clips.twitch.tv") {
		const clipId = url.searchParams.get("clip") || url.pathname.substring(1);
		embedUrl = new URL(`https://clips.twitch.tv/embed`);
		embedUrl.searchParams.set("clip", clipId);
	}

	// TODO: add support for twitch "video" and "collection" URLs
	// https://dev.twitch.tv/docs/embed/everything/#usage
	// https://github.com/MichaelDeBoey/gatsby-remark-embedder/blob/e80bce7d3adfc19f4ab5fc9cead9da9f60cedb55/src/transformers/Twitch.js

	if (!embedUrl) {
		embedUrl = url;
	}

	// Set the "parent" property for embedding - https://dev.twitch.tv/docs/embed/everything/#usage
	embedUrl.searchParams.set("parent", parent);

	return {
		html: `<iframe src="${embedUrl.toString()}" height="300"></iframe>`,
		title: "Twitch Embed",
	};
}

export const twitchHosts = ["clips.twitch.tv", "twitch.tv"];
