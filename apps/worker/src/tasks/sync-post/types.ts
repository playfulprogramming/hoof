import { Type } from "@sinclair/typebox";

export const PostMetaSchema = Type.Object(
	{
		title: Type.String(),
		published: Type.String(),
		description: Type.String({ default: "" }),
		version: Type.String({ default: "" }),
		noindex: Type.Optional(Type.Boolean({ default: false })),
		authors: Type.Optional(Type.Array(Type.String())),
		tags: Type.Optional(Type.Array(Type.String())),
		edited: Type.Optional(Type.String()),
		socialImg: Type.Optional(Type.String()),
		bannerImg: Type.Optional(Type.String()),
		originalLink: Type.Optional(Type.String()),
		order: Type.Optional(Type.Number()),
		upToDateSlug: Type.Optional(Type.String()),
		license: Type.Optional(
			Type.Union([
				Type.Literal("cc-by-4"),
				Type.Literal("cc-by-nc-sa-4"),
				Type.Literal("cc-by-nc-nd-4"),
				Type.Literal("publicdomain-zero-1"),
			]),
		),
	},
	{
		additionalProperties: false,
	},
);
