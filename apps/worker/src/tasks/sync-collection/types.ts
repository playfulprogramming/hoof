import { Type } from "@sinclair/typebox";

const ButtonTextUrlSchema = Type.Object(
	{
		text: Type.String(),
		url: Type.String(),
	},
	{
		additionalProperties: false,
		examples: [
			{
				text: "Learn More",
				url: "https://example.com/learn-more",
			},
		],
	},
);

const ButtonPostUrlSchema = Type.Object(
	{
		post: Type.String(),
	},
	{
		additionalProperties: false,
		examples: [
			{
				post: "abc123",
			},
		],
	},
);

export const CollectionMetaSchema = Type.Object(
	{
		title: Type.String(),
		description: Type.String({ default: "" }),
		coverImg: Type.Optional(Type.String()),
		published: Type.String(),
		tags: Type.Array(Type.String(), { default: [] }),
		buttons: Type.Array(Type.Union([ButtonTextUrlSchema, ButtonPostUrlSchema]), { default: [] }),
	},
	{
		additionalProperties: false,
		examples: [
			{
				title: "My Collection",
				description: "A collection of my favorite posts.",
				coverImg: "./cover.jpg",
				published: "2023-01-01T00:00:00Z",
				tags: ["tag1", "tag2"],
				buttons: [
					{
						text: "Learn More",
						url: "/learn-more",
					},
					{
						post: "abc123",
					},
				],
			},
		],
	},
);
