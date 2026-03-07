import { fetchAsBot } from "../../../utils/fetchAsBot.ts";
import type { TweetAPIResponse } from "./fx-embed/types.ts";

interface GetXPostDataProps {
	userId: string;
	postId: string;
	signal: AbortSignal;
}

export async function getXPostData({
	userId,
	postId,
	signal,
}: GetXPostDataProps) {
	const res = await fetchAsBot({
		url: new URL(`https://api.fxtwitter.com/${userId}/status/${postId}`),
		method: "GET",
		skipRobotsCheck: true,
		signal,
	});
	const json = (await res.body.json()) as TweetAPIResponse;
	return json.tweet;
}
