import {
	pgTable,
	text,
	timestamp,
	jsonb,
	primaryKey,
	integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { profiles } from "./profiles.ts";
import { posts } from "./posts.ts";

export const collections = pgTable("collections", {
	slug: text("slug").primaryKey(),
});

export const collectionData = pgTable(
	"collection_data",
	{
		slug: text("slug")
			.notNull()
			.references(() => collections.slug, { onDelete: "cascade" }),
		locale: text("locale").notNull(),
		title: text("title").notNull(),
		description: text("description").notNull().default(""),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		meta: jsonb("meta").notNull(),
		coverImage: text("cover_image"),
		socialImage: text("social_image"),
	},
	(table) => [primaryKey({ columns: [table.slug, table.locale] })],
);

export const collectionAuthors = pgTable(
	"collection_authors",
	{
		collectionSlug: text("collection_slug")
			.notNull()
			.references(() => collections.slug, { onDelete: "cascade" }),
		authorSlug: text("author_slug")
			.notNull()
			.references(() => profiles.slug, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({
			columns: [table.collectionSlug, table.authorSlug],
		}),
	],
);

export const collectionChapters = pgTable("collection_chapters", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	locale: text("locale").notNull(),
	collectionSlug: text("collection_slug")
		.notNull()
		.references(() => collections.slug, { onDelete: "cascade" }),
	postSlug: text("post_slug")
		.notNull()
		.references(() => posts.slug, { onDelete: "cascade" }),
	title: text("title").notNull(),
	description: text("description").notNull().default(""),
	url: text("url").notNull(),
	order: integer("order").notNull(),
});

/**
 * Query via:
 * @example
 * const collectionWithAuthors = await db.query.collections.findFirst({
 *   where: (collections, { and, eq }) => and(
 *     eq(collections.slug, "my-collection-slug"),
 *     eq(collections.locale, "en")
 *   ),
 *   with: {
 *     authors: {
 *       with: {
 *         author: true,
 *       },
 *     },
 *   },
 * });
 */
export const collectionsRelations = relations(collections, ({ many }) => ({
	authors: many(collectionAuthors),
	chapters: many(collectionChapters),
}));

export const collectionAuthorsRelations = relations(
	collectionAuthors,
	({ one }) => ({
		collection: one(collections, {
			fields: [collectionAuthors.collectionSlug],
			references: [collections.slug],
		}),
		author: one(profiles, {
			fields: [collectionAuthors.authorSlug],
			references: [profiles.slug],
		}),
	}),
);

export const collectionChaptersRelations = relations(
	collectionChapters,
	({ one }) => ({
		collection: one(collections, {
			fields: [collectionChapters.collectionSlug],
			references: [collections.slug],
		}),
		post: one(posts, {
			fields: [collectionChapters.postSlug],
			references: [posts.slug],
		}),
	}),
);
