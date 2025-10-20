import { Type, type Static } from "@sinclair/typebox";

export const SyncAuthorInputSchema = Type.Object(
	{
		author: Type.String(),
		ref: Type.String(),
	},
	{
		additionalProperties: false,
		examples: [
			{
				author: "fennifith",
				ref: "main",
			},
		],
	},
);

export type SyncAuthorInput = Static<typeof SyncAuthorInputSchema>;

export type SyncAuthorOutput = void;
