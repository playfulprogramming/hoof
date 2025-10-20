import { Type, type Static } from "@sinclair/typebox";

export const SyncPostInputSchema = Type.Object(
	{
		author: Type.String(),
		collection: Type.Optional(Type.String()),
		post: Type.String(),
		ref: Type.String(),
	},
	{
		additionalProperties: false,
		examples: [
			{
				author: "edpratti",
				collection: "git-guide",
				post: "git-into-the-weeds",
				ref: "main",
			},
		],
	},
);

export type SyncPostInput = Static<typeof SyncPostInputSchema>;

export type SyncPostOutput = void;
