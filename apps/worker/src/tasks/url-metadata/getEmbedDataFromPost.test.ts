import { db, urlMetadataPost } from "@playfulprogramming/db";
import { mockEndpoint } from "../../../test-utils/server.ts";
import { getEmbedDataFromPost } from "./getEmbedDataFromPost.ts";
import { type Mock } from "vitest";

const fakeFxTwitterTweet = {
	created_at: "2023-01-28T12:00:00.000Z",
	created_timestamp: 1643366400,
	likes: 2,
	reposts: 3,
	replies: 4,
	media: {},
	author: {
		id: "playful_program",
		name: "Playful Programming",
		screen_name: "playful_program",
		avatar_url: "https://example.test/avatar.png",
		banner_url: null,
		description: "",
		location: "Earth",
		url: "https://x.com/playful_program",
		protected: false,
		followers: 1000,
		following: 100,
		statuses: 2,
		media_count: 10,
		likes: 100,
		joined: "2022-01-28T12:00:00.000Z",
		website: null,
		birthday: {},
	},
	lang: null,
	possibly_sensitive: false,
	replying_to: null,
	source: null,
	is_note_tweet: false,
	community_note: null,
	embed_card: "tweet",
	provider: "twitter",
};

const fakeFxTwitterResponse = {
	code: 200,
	message: "Tweet found",
	tweet: {
		...fakeFxTwitterTweet,
		id: "1917675872854614490",
		url: "https://x.com/playful_program/status/1917675872854614490",
		text: "This is a tweet with an image",
		raw_text: {
			text: "This is a tweet with an image",
			facets: [],
		},
		media: {
			photos: [
				{
					type: "photo",
					altText: "Alt text here",
					height: 100,
					width: 100,
					url: "https://example.test/image.png",
				},
			],
		},
	},
};

const fakeFxTwitterUrl =
	"https://x.com/playful_program/status/1917675879695552789";

test("fetches the expected information for a successful tweet response", async () => {
	mockEndpoint({
		path: `https://api.fxtwitter.com/playful_program/status/1917675879695552789`,
		body: JSON.stringify(fakeFxTwitterResponse),
	});

	mockEndpoint({
		path: "https://example.test/avatar.png",
		body: Uint8Array.from(
			Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
				"base64",
			),
		).buffer,
	});

	mockEndpoint({
		path: "https://example.test/image.png",
		body: Uint8Array.from(
			Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
				"base64",
			),
		).buffer,
	});

	const response = await getEmbedDataFromPost(
		fakeFxTwitterUrl,
		new URL(fakeFxTwitterUrl),
		new AbortController().signal,
	);

	expect(response).toEqual({
		error: false,
		postId: "x:1917675879695552789",
	});

	const urlMetadataPostInsert = db.insert(urlMetadataPost).values as Mock;

	expect(urlMetadataPostInsert).toBeCalledTimes(1);
	expect(urlMetadataPostInsert).toBeCalledWith({
		authorHandle: "playful_program",
		authorName: "Playful Programming",
		avatarKey: "remote-posts-4c0e4308375bc869fdb647e67d549c67.png",
		avatarHeight: 1,
		avatarWidth: 1,
		content: "This is a tweet with an image",
		createdAt: new Date("2023-01-28T12:00:00.000Z"),
		imageKey: "remote-posts-829080890080bd67c2514cb5e6cf5796.png",
		imageHeight: 1,
		imageWidth: 1,
		imageAltText: "Alt text here",
		numLikes: 2,
		numReplies: 4,
		numReposts: 3,
		postId: "x:1917675879695552789",
		url: "https://x.com/playful_program/status/1917675872854614490",
	});
});
