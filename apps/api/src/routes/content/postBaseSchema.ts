import { Type } from "typebox";

/** Fields common to every post representation returned by the content API. */
export const PostBaseSchema = Type.Object({
	slug: Type.String(),
	title: Type.String(),
	bannerUrl: Type.Optional(Type.String()),
	wordCount: Type.Number(),
	publishedAt: Type.Optional(Type.String({ format: "date-time" })),
	authors: Type.Array(
		Type.Object({
			id: Type.String(),
			name: Type.String(),
			profileImageUrl: Type.Optional(Type.String()),
		}),
	),
});
