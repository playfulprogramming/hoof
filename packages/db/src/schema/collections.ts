import {
	pgTable,
	text,
	timestamp,
	jsonb,
	primaryKey,
	uuid,
	unique,
} from "drizzle-orm/pg-core";
import { authorSlugs } from "./authors.ts";
import { attachments } from "./attachments.ts";

export const collectionSlugs = pgTable("collection_slugs", {
	slug: text("slug").primaryKey(),
});

export const collections = pgTable(
	"collections",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		slug: text("slug")
			.notNull()
			.references(() => collectionSlugs.slug, { onDelete: "cascade" }),
		locale: text("locale").notNull(),
		branch: text("branch").notNull(),
		title: text("title").notNull(),
		description: text("description").notNull().default(""),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		meta: jsonb("meta").notNull(),
		coverImage: text("cover_image"),
		socialImage: text("social_image"),
	},
	(table) => [unique().on(table.slug, table.locale, table.branch)],
);

export const collectionAuthors = pgTable(
	"collection_authors",
	{
		collectionId: uuid("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		authorSlug: text("author_slug")
			.notNull()
			.references(() => authorSlugs.slug, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({
			columns: [table.collectionId, table.authorSlug],
		}),
	],
);

export const collectionTags = pgTable(
	"collection_tags",
	{
		collectionId: uuid("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		tag: text("tag").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.collectionId, table.tag],
		}),
	],
);

export const collectionAttachments = pgTable(
	"collection_attachments",
	{
		collectionId: uuid("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		attachmentKey: text("attachment_key")
			.notNull()
			.references(() => attachments.attachmentKey, {
				onDelete: "cascade",
			}),
		attachmentName: text("attachment_name").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.collectionId, table.attachmentName],
		}),
	],
);
