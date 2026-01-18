import { Type } from "@sinclair/typebox";

/**
 * Schema for validating post markdown frontmatter.
 *
 * Example frontmatter:
 * ```yaml
 * ---
 * title: "My Blog Post"
 * description: "A short description"
 * published: "2024-01-15T00:00:00Z"
 * authors:
 *   - co-author-slug
 * tags:
 *   - javascript
 *   - tutorial
 * order: 1
 * ---
 * ```
 */
export const PostMetaSchema = Type.Object(
	{
		// Required fields
		title: Type.String(),
		published: Type.String(), // ISO date string

		// Optional fields with defaults
		description: Type.String({ default: "" }),
		version: Type.String({ default: "" }),
		noindex: Type.Boolean({ default: false }),

		// Optional fields (nullable)
		authors: Type.Optional(Type.Array(Type.String())),
		tags: Type.Optional(Type.Array(Type.String())),
		edited: Type.Optional(Type.String()), // ISO date string
		socialImg: Type.Optional(Type.String()),
		bannerImg: Type.Optional(Type.String()),
		originalLink: Type.Optional(Type.String()),

		// For collection posts - determines chapter order
		order: Type.Optional(Type.Number()),
	},
	{
		// Fail if frontmatter has unknown fields (catches typos)
		additionalProperties: false,
	},
);
