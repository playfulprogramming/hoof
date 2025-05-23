import { pgTable, varchar } from "drizzle-orm/pg-core";

export const postImages = pgTable("post_images", {
	slug: varchar("slug", { length: 2048 }).primaryKey(),
	bannerKey: varchar("banner_key", { length: 2048 }).notNull(),
	linkPreviewKey: varchar("link_preview_key", { length: 2048 }).notNull(),
});
