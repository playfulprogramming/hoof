import { db, urlMetadataPost } from "@playfulprogramming/db";
import { type EmbedData, BUCKET } from "./common.ts";
import { getXPostData } from "./data-providers/x.ts";
import {
	type ProcessImageResult,
	processImages,
} from "./utils/processImage.ts";

const xHosts = ["x.com", "twitter.com"];
function isXPostUrl(url: URL) {
	if (!xHosts.includes(url.hostname)) return false;
	const parts = url.pathname.split("/").filter(Boolean);
	return parts.length >= 3 && parts[1] === "status";
}

export function isPostUrl(url: URL) {
	return isXPostUrl(url);
}

export async function getEmbedDataFromPost(
	jobId: string,
	inputUrl: URL,
	signal: AbortSignal,
): Promise<EmbedData> {
	let error = false;

	const xPathParts = inputUrl.pathname.split("/").filter(Boolean);
	const userId = xPathParts[0];
	const postId = xPathParts[2];
	if (!userId || !postId) return { error: true };

	const post = await getXPostData({ userId, postId, signal }).catch((e) => {
		console.error(`Error fetching x post '${inputUrl}'`, e);
		return undefined;
	});

	if (!post) return { error: true };

	const dbPostId = `x:${postId}`;

	const avatarUrl = post.author.avatar_url;
	let avatarResult: ProcessImageResult | undefined = undefined;
	if (avatarUrl) {
		avatarResult = await processImages(
			[new URL(avatarUrl)],
			72,
			BUCKET,
			"remote-posts",
			jobId,
			signal,
		).catch((e) => {
			console.error(`Error processing post image for '${inputUrl}'`, e);
			error = true;
			return undefined;
		});
	}

	const image = post?.media?.photos?.[0];
	let imageResult: ProcessImageResult | undefined = undefined;
	if (image) {
		imageResult = await processImages(
			[new URL(image.url)],
			image.width,
			BUCKET,
			"remote-posts",
			jobId,
			signal,
		).catch((e) => {
			console.error(`Error processing post image for '${inputUrl}'`, e);
			error = true;
			return undefined;
		});
	}

	const postData = {
		postId: dbPostId,
		authorName: post.author.name,
		authorHandle: post.author.screen_name,
		content: post.text,
		url: post.url,
		avatarKey: avatarResult?.key,
		avatarWidth: avatarResult?.width,
		avatarHeight: avatarResult?.height,
		imageKey: imageResult?.key,
		imageWidth: imageResult?.width,
		imageHeight: imageResult?.height,
		imageAltText: image?.altText,
		numLikes: post.likes,
		numReposts: post.reposts,
		numReplies: post.replies,
		createdAt: new Date(post.created_at),
	};

	await db
		.insert(urlMetadataPost)
		.values(postData)
		.onConflictDoUpdate({ target: urlMetadataPost.postId, set: postData });

	return {
		postId: dbPostId,
		error,
	};
}
