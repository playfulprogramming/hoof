import { pgTable, text, primaryKey } from "drizzle-orm/pg-core";
import { posts } from "./posts.ts";
import { collections } from "./collections.ts";

export const postTags = pgTable(
	"post_tags",
	{
		postSlug: text("post_slug")
			.notNull()
			.references(() => posts.slug, {
				onDelete: "cascade",
			}),
		tag: text("tag").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.postSlug, table.tag],
		}),
	],
);

export const collectionTags = pgTable(
	"collection_tags",
	{
		collectionSlug: text("collection_slug")
			.notNull()
			.references(() => collections.slug, { onDelete: "cascade" }),
		tag: text("tag").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.collectionSlug, table.tag],
		}),
	],
);
