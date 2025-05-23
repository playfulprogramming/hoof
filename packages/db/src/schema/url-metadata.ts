import {
	integer,
	pgTable,
	timestamp,
	varchar,
	boolean,
} from "drizzle-orm/pg-core";

export const urlMetadata = pgTable("url_metadata", {
	url: varchar("url", { length: 2048 }).primaryKey(),
	title: varchar("title", { length: 2048 }),
	iconKey: varchar("icon_key", { length: 2048 }),
	iconWidth: integer("icon_width"),
	iconHeight: integer("icon_height"),
	bannerKey: varchar("banner_key", { length: 2048 }),
	bannerWidth: integer("banner_width"),
	bannerHeight: integer("banner_height"),
	fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
	error: boolean("error").notNull(),
});
