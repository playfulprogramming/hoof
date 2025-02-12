import { Type, Static } from "@sinclair/typebox";

export const UrlMetadataInputSchema = Type.Object(
	{
		url: Type.String({ format: "uri" }),
	},
	{
		additionalProperties: false,
	}
);

export const UrlMetadataOutputSchema = Type.Object(
	{
		title: Type.Optional(Type.String()),
		icon: Type.Optional(Type.String()),
		banner: Type.Optional(Type.String()),
	},
	{
		additionalProperties: false,
	}
);

export type UrlMetadataInput = Static<typeof UrlMetadataInputSchema>;
export type UrlMetadataOutput = Static<typeof UrlMetadataOutputSchema>;
