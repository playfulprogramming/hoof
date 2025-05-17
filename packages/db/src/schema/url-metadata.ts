import { pgTable, varchar } from "drizzle-orm/pg-core";

export const urlMetadata = pgTable("url_metadata", {
	url: varchar("url", { length: 2048 }).primaryKey(),
	title: varchar("title", { length: 2048 }),
	icon: varchar("icon", { length: 2048 }),
	banner: varchar("banner", { length: 2048 }),
});
