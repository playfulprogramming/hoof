import { Type, Static } from "@sinclair/typebox";

export const PostImageInputSchema = Type.Object(
	{
		slug: Type.String(),
	},
	{
		additionalProperties: false,
	},
);

export type PostImageInput = Static<typeof PostImageInputSchema>;
