import { fetchAsBot } from "../../../utils/fetchAsBot.ts";
import type { TweetAPIResponse } from "./fx-embed/types.ts";

interface GetXPostDataProps {
	userId: string;
	postId: string;
}

export async function getXPostData({ userId, postId }: GetXPostDataProps) {
	const res = await fetchAsBot({
		url: new URL(`https://api.fxtwitter.com/${userId}/status/${postId}`),
		method: "GET",
		skipRobotsCheck: true,
	});
	const json = (await res.body.json()) as TweetAPIResponse;
	return json.tweet;
}
