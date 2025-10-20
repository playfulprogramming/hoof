import { Type, type Static } from "@sinclair/typebox";

export const SyncCollectionInputSchema = Type.Object(
	{
		author: Type.String(),
		collection: Type.String(),
		ref: Type.String(),
	},
	{
		additionalProperties: false,
		examples: [
			{
				author: "edpratti",
				collection: "git-guide",
				ref: "main",
			},
		],
	},
);

export type SyncCollectionInput = Static<typeof SyncCollectionInputSchema>;

export type SyncCollectionOutput = void;
