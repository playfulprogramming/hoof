import {
	pgTable,
	text,
	timestamp,
	jsonb,
	primaryKey,
	boolean,
	integer,
	uuid,
	unique,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles.ts";
import { collections } from "./collections.ts";
import { attachments } from "./attachments.ts";

export const postGroups = pgTable("post_groups", {
	id: uuid("id").primaryKey().defaultRandom(),
});

export const posts = pgTable(
	"posts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		slug: text("slug").notNull(),
		locale: text("locale").notNull(),
		branch: text("branch").notNull(),
		collectionSlug: text("collection_slug").references(() => collections.slug, {
			onDelete: "set null",
		}),
		collectionOrder: integer("collection_order").notNull().default(0),
		groupId: uuid("group_id").references(() => postGroups.id, {
			onDelete: "cascade",
		}),
		versionName: text("version_name").notNull().default(""),
		versionOrder: integer("version_order").notNull().default(0),
		title: text("title").notNull(),
		description: text("description").notNull().default(""),
		wordCount: integer("word_count").notNull().default(0),
		socialImage: text("social_image"),
		bannerImage: text("banner_image"),
		originalLink: text("original_link"),
		noindex: boolean("noindex").notNull().default(false),
		editedAt: timestamp("edited_at", { withTimezone: true }),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		meta: jsonb("meta").notNull(),
	},
	(table) => [unique().on(table.slug, table.locale, table.branch)],
);

export const postAuthors = pgTable(
	"post_authors",
	{
		postId: uuid("post_id")
			.notNull()
			.references(() => posts.id, {
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
			columns: [table.postId, table.authorSlug],
		}),
	],
);

export const postTags = pgTable(
	"post_tags",
	{
		postId: uuid("post_id")
			.notNull()
			.references(() => posts.id, {
				onDelete: "cascade",
			}),
		tag: text("tag").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.postId, table.tag],
		}),
	],
);

export const postAttachments = pgTable(
	"post_attachments",
	{
		postId: uuid("post_id")
			.notNull()
			.references(() => posts.id, {
				onDelete: "cascade",
			}),
		attachmentKey: text("attachment_key")
			.notNull()
			.references(() => attachments.attachmentKey, {
				onDelete: "cascade",
			}),
		attachmentName: text("attachment_name").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.postId, table.attachmentKey],
		}),
	],
);
