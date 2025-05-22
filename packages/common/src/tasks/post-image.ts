import { Type, type Static } from "@sinclair/typebox";

export const PostImageInputSchema = Type.Object(
	{
		slug: Type.String(),
		title: Type.String(),
		authors: Type.Array(
			Type.Object({
				name: Type.String(),
				image: Type.String(),
			}),
		),
		tags: Type.Array(
			Type.Object({
				displayName: Type.String(),
				image: Type.Optional(Type.String()),
				emoji: Type.Optional(Type.String()),
			}),
		),
		publishedMeta: Type.String(),
		wordCount: Type.Number(),
		code: Type.String(),
	},
	{
		additionalProperties: false,
	},
);

export type PostImageInput = Static<typeof PostImageInputSchema>;
