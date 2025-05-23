import { Type, type Static } from "@sinclair/typebox";

export const PostImageInputSchema = Type.Object(
	{
		slug: Type.String(),
		// `path` and `author` are temporary, will be removed after https://github.com/playfulprogramming/hoof/issues/18
		author: Type.String(),
		path: Type.String(),
	},
	{
		additionalProperties: false,
	},
);

export type PostImageInput = Static<typeof PostImageInputSchema>;

export interface PostImageOutput {
	bannerKey: string;
	linkPreviewKey: string;
}
