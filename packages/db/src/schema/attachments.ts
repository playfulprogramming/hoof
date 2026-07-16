import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const attachments = pgTable("attachments", {
	attachmentKey: text("attachment_key").primaryKey(),
	sha: text("sha").notNull(),
	width: integer("width"),
	height: integer("height"),
});
