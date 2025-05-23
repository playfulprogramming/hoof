import type satori from "satori";

export interface PostImageData {
	slug: string;
	title: string;
	authors: Array<{ name: string; image: string }>;
	tags: Array<{
		displayName: string;
		image?: string;
		emoji?: string;
	}>;
	publishedMeta: string;
	wordCount: number;
	code: string;
}

export type LayoutFunction = (
	post: PostImageData,
) => Promise<Parameters<typeof satori>[0]>;
