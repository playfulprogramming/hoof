import { Type, Static } from "@sinclair/typebox";

export const UrlMetadataInputSchema = Type.Object(
	{
		url: Type.String({ format: "uri" }),
	},
	{
		additionalProperties: false,
	}
);

export type UrlMetadataInput = Static<typeof UrlMetadataInputSchema>;
