import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const attachments = pgTable("attachments", {
	attachmentKey: text("attachment_key").primaryKey(),
	sha: text("sha").notNull(),
	width: integer("width"),
	height: integer("height"),
	lastModified: timestamp("last_modified", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
