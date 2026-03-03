import {
	type YouTubeOEmbedResponse,
	youtubeHosts,
	getYouTubeOEmbedDataFromUrl,
} from "./youtube.ts";
import {
	type VimeoOEmbedResponse,
	vimeoHosts,
	getVimeoOEmbedDataFromUrl,
} from "./vimeo.ts";
import {
	getTwitchOEmbedDataFromUrl,
	twitchHosts,
	type TwitchOEmbedResponse,
} from "./twitch.ts";

export async function getVideoDataFromUrl(
	url: URL,
): Promise<
	YouTubeOEmbedResponse | VimeoOEmbedResponse | TwitchOEmbedResponse | null
> {
	if (youtubeHosts.includes(url.hostname)) {
		return getYouTubeOEmbedDataFromUrl(url);
	}

	if (vimeoHosts.includes(url.hostname)) {
		return getVimeoOEmbedDataFromUrl(url);
	}

	if (twitchHosts.includes(url.hostname)) {
		return getTwitchOEmbedDataFromUrl(url);
	}

	return null;
}

export const videoHosts = [...youtubeHosts, ...vimeoHosts];
