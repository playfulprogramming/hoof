import { Type, type Static } from "@sinclair/typebox";

export const UrlMetadataInputSchema = Type.Object(
	{
		url: Type.String({ format: "uri" }),
	},
	{
		additionalProperties: false,
	},
);

export type UrlMetadataInput = Static<typeof UrlMetadataInputSchema>;

export interface UrlMetadataOutput {
	url: string;
	title: string | null;
	iconKey: string | null;
	iconWidth: number | null;
	iconHeight: number | null;
	bannerKey: string | null;
	bannerWidth: number | null;
	bannerHeight: number | null;
	error: boolean;
}
