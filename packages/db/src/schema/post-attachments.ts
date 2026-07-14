import { pgTable, text, integer, primaryKey } from "drizzle-orm/pg-core";
import { posts } from "./posts.ts";

export const postAttachments = pgTable(
	"post_attachments",
	{
		postSlug: text("post_slug")
			.notNull()
			.references(() => posts.slug, {
				onDelete: "cascade",
			}),
		attachmentName: text("attachment_name").notNull(),
		attachmentKey: text("attachment_key").notNull(),
		sha: text("sha").notNull(),
		width: integer("width"),
		height: integer("height"),
	},
	(table) => [
		primaryKey({
			columns: [table.postSlug, table.attachmentName],
		}),
	],
);
