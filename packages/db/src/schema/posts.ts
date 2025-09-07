import {
	pgTable,
	text,
	timestamp,
	jsonb,
	primaryKey,
	foreignKey,
	boolean,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles.ts";
import { relations } from "drizzle-orm";

export const posts = pgTable(
	"posts",
	{
		slug: text("slug").notNull(),
		locale: text("locale").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		socialImage: text("social_image"),
		bannerImage: text("banner_image"),
		version: text("version"),
		originalLink: text("original_link"),
		noindex: boolean("noindex"),
		editedAt: timestamp("edited_at"),
		publishedAt: timestamp("published_at").$default(() => new Date()),
		meta: jsonb("meta"),
	},
	(table) => [primaryKey({ columns: [table.slug, table.locale] })],
);

export const postAuthors = pgTable(
	"post_authors",
	{
		postSlug: text("post_slug").notNull(),
		postLocale: text("post_locale").notNull(),
		authorSlug: text("author_slug").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.postSlug, table.postLocale, table.authorSlug],
		}),
		foreignKey({
			columns: [table.postSlug, table.postLocale],
			foreignColumns: [posts.slug, posts.locale],
		}),
		foreignKey({
			columns: [table.authorSlug],
			foreignColumns: [profiles.slug],
		}),
	],
);

export const postsRelations = relations(posts, ({ many }) => ({
	authors: many(postAuthors),
}));

export const postAuthorsRelations = relations(
	postAuthors,
	({ one }) => ({
		post: one(posts, {
			fields: [
				postAuthors.postSlug,
				postAuthors.postLocale,
			],
			references: [posts.slug, posts.locale],
		}),
		author: one(profiles, {
			fields: [postAuthors.authorSlug],
			references: [profiles.slug],
		}),
	}),
);