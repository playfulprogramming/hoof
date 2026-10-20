import { fetchAsBot } from "../../../utils/fetchAsBot.ts";

interface BlueskyAPIResponse {
	posts: {
		author: {
			handle: string;
			displayName: string;
			avatar: string;
		};
		record: {
			createdAt: string;
			text: string;
		};
		replyCount: number;
		repostCount: number;
		likeCount: number;
	}[];
}

export interface GetBlueskyPostDataProps {
	userHandle: string;
	postId: string;
	signal: AbortSignal;
}

export async function getBlueskyPostData({
	userHandle,
	postId,
	signal,
}: GetBlueskyPostDataProps) {
	const baseUrl = "https://public.api.bsky.app/xrpc";

	const didRes = await fetchAsBot({
		url: `${baseUrl}/com.atproto.identity.resolveHandle?handle=${userHandle}`,
		method: "GET",
		skipRobotsCheck: true,
		signal,
	});
	const didData = (await didRes.body.json()) as { did: string };
	const did = didData.did;
	const uri = `at://${did}/app.bsky.feed.post/${postId}`;

	const res = await fetchAsBot({
		url: `${baseUrl}/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`,
		method: "GET",
		skipRobotsCheck: true,
		signal,
	});
	const json = (await res.body.json()) as BlueskyAPIResponse;

	if (!json.posts?.length) {
		res.body.dump();
		throw new Error(
			`No post found for userHandle: ${userHandle}, postId: ${postId}`,
		);
	}

	return json.posts[0];
}
