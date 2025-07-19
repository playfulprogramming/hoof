import { pgTable, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const postImages = pgTable("post_images", {
	slug: varchar("slug", { length: 2048 }).primaryKey(),
	bannerKey: varchar("banner_key", { length: 2048 }),
	linkPreviewKey: varchar("link_preview_key", { length: 2048 }),
	indexMd5: varchar("index_md5", { length: 2048 }),
	fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
	error: boolean("error").notNull(),
});
