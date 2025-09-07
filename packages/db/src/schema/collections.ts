import {
	pgTable,
	text,
	timestamp,
	jsonb,
	primaryKey,
	foreignKey,
	integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { profiles } from "./profiles.ts";
import { posts } from "./posts.ts";

export const collections = pgTable(
	"collections",
	{
		slug: text("slug").notNull(),
		locale: text("locale").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		publishedAt: timestamp("published_at").$default(() => new Date()),
		meta: jsonb("meta"),
	},
	(table) => [primaryKey({ columns: [table.slug, table.locale] })],
);

export const collectionAuthors = pgTable(
	"collection_authors",
	{
		collectionSlug: text("collection_slug").notNull(),
		collectionLocale: text("collection_locale").notNull(),
		authorSlug: text("author_slug").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.collectionSlug, table.collectionLocale, table.authorSlug],
		}),
		foreignKey({
			columns: [table.collectionSlug, table.collectionLocale],
			foreignColumns: [collections.slug, collections.locale],
		}),
		foreignKey({
			columns: [table.authorSlug],
			foreignColumns: [profiles.slug],
		}),
	],
);

export const collectionChapters = pgTable(
	"collection_chapters",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		locale: text("locale").notNull(),
		collectionSlug: text("collection_slug").notNull(),
		postSlug: text("post_slug").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		url: text("url").notNull(),
		order: integer("order").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.collectionSlug, table.locale],
			foreignColumns: [collections.slug, collections.locale],
			name: "fk_collection_chapters_collection",
		}),
		foreignKey({
			columns: [table.postSlug, table.locale],
			foreignColumns: [posts.slug, posts.locale],
			name: "fk_collection_chapters_post",
		}),
	],
);

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
			fields: [
				collectionAuthors.collectionSlug,
				collectionAuthors.collectionLocale,
			],
			references: [collections.slug, collections.locale],
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
			fields: [collectionChapters.collectionSlug, collectionChapters.locale],
			references: [collections.slug, collections.locale],
		}),
		post: one(posts, {
			fields: [collectionChapters.postSlug, collectionChapters.locale],
			references: [posts.slug, posts.locale],
		}),
	}),
);
