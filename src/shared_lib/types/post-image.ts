import { Type, Static } from "@sinclair/typebox";

export const PostImageInputSchema = Type.Object(
	{
		slug: Type.String(),
	},
	{
		additionalProperties: false,
	}
);

export const PostImageOutputSchema = Type.Object(
	{
		bannerImageUrl: Type.String({ format: "uri" }),
		socialImageUrl: Type.String({ format: "uri" }),
	},
	{
		additionalProperties: false,
	}
);

export type PostImageInput = Static<typeof PostImageInputSchema>;
export type PostImageOutput = Static<typeof PostImageOutputSchema>;
