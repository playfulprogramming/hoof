import {
	pgTable,
	text,
	timestamp,
	jsonb,
	primaryKey,
	boolean,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles.ts";
import { relations } from "drizzle-orm";

export const posts = pgTable("posts", {
	slug: text("slug").primaryKey(),
});

export const postData = pgTable(
	"post_data",
	{
		slug: text("slug")
			.notNull()
			.references(() => posts.slug, {
				onDelete: "cascade",
			}),
		locale: text("locale").notNull(),
		title: text("title").notNull(),
		version: text("version").notNull().default(""),
		description: text("description").notNull().default(""),
		socialImage: text("social_image"),
		bannerImage: text("banner_image"),
		originalLink: text("original_link"),
		noindex: boolean("noindex").notNull().default(false),
		editedAt: timestamp("edited_at", { withTimezone: true }),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		meta: jsonb("meta").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.slug, table.locale, table.version] }),
	],
);

export const postAuthors = pgTable(
	"post_authors",
	{
		postSlug: text("post_slug")
			.notNull()
			.references(() => posts.slug, {
				onDelete: "cascade",
			}),
		authorSlug: text("author_slug")
			.notNull()
			.references(() => profiles.slug, {
				onDelete: "cascade",
			}),
	},
	(table) => [
		primaryKey({
			columns: [table.postSlug, table.authorSlug],
		}),
	],
);

export const postsRelations = relations(posts, ({ many }) => ({
	authors: many(postAuthors),
}));

export const postAuthorsRelations = relations(postAuthors, ({ one }) => ({
	post: one(posts, {
		fields: [postAuthors.postSlug],
		references: [posts.slug],
	}),
	author: one(profiles, {
		fields: [postAuthors.authorSlug],
		references: [profiles.slug],
	}),
}));
