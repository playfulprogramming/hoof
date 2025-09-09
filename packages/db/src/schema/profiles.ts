import { pgTable, timestamp, jsonb, text } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
	slug: text("slug").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull().default(""),
	profileImage: text("profile_image"),
	publishedAt: timestamp("published_at", { withTimezone: true })
		.notNull()
		.$default(() => new Date()),
	meta: jsonb("meta").notNull(),
});
