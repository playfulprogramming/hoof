import type { PostImageData } from "../src/types.ts";
import fs from "fs/promises";

export async function mockPostData(): Promise<PostImageData> {
	const profileImage = await fs.readFile("./tests/profile.png");

	return {
		slug: "example-post",
		title: "Example Post",
		authors: [
			{
				name: "Example Author",
				image: `data:image/png;base64,${profileImage.toString("base64")}`,
			},
		],
		tags: [
			{
				displayName: "Angular",
				emoji: "🦆",
			},
			{
				displayName: "Web Development",
				emoji: "🦆",
			},
		],
		publishedMeta: "Jan 1, 2001",
		wordCount: 12345,
		code: "Lorem\nipsum\ndolor\nsit\namet,\n  consectetur adipiscing\n\telit.",
		indexMd5: "6cd3556deb0da54bca060b4c39479839",
	};
}
