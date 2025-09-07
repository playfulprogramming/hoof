import {
	pgTable,
	text,
	timestamp,
	jsonb,
	primaryKey,
	boolean,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles.ts";

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
		authorSlug: text("author_slug")
			.notNull()
			.references(() => profiles.slug),
	},
	(table) => [primaryKey({ columns: [table.slug, table.locale] })],
);
