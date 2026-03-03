import {
	integer,
	pgTable,
	timestamp,
	varchar,
	boolean,
	primaryKey,
} from "drizzle-orm/pg-core";

export const urlMetadataGist = pgTable("url_metadata_gist", {
	gistId: varchar("gist_id", { length: 256 }).primaryKey(),
	username: varchar("username", { length: 256 }).notNull(),
	description: varchar("description", { length: 2048 }),
});

export const urlMetadataGistFile = pgTable(
	"url_metadata_gist_file",
	{
		gistId: varchar("gist_id", { length: 256 })
			.notNull()
			.references(() => urlMetadataGist.gistId, { onDelete: "cascade" }),
		filename: varchar("filename", { length: 256 }).notNull(),
		contentKey: varchar("content_key", { length: 256 }).notNull(),
		language: varchar("language", { length: 16 }).notNull(),
	},
	(table) => [primaryKey({ columns: [table.gistId, table.filename] })],
);

export const urlMetadataPost = pgTable("url_metadata_post", {
	postId: varchar("post_id", { length: 256 }).primaryKey(),
	authorName: varchar("author_name", { length: 2048 }).notNull(),
	authorHandle: varchar("author_handle", { length: 2048 }).notNull(),
	content: varchar("content", { length: 2048 }).notNull(),
	url: varchar("url", { length: 2048 }).notNull(),
	avatarKey: varchar("avatar_key", { length: 256 }),
	avatarWidth: integer("avatar_width"),
	avatarHeight: integer("avatar_height"),
	imageKey: varchar("image_key", { length: 256 }),
	imageWidth: integer("image_width"),
	imageHeight: integer("image_height"),
	imageAltText: varchar("image_alt_text", { length: 2048 }),
	numLikes: integer("num_likes"),
	numReposts: integer("num_reposts"),
	numReplies: integer("num_replies"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const urlMetadata = pgTable("url_metadata", {
	url: varchar("url", { length: 2048 }).primaryKey(),
	title: varchar("title", { length: 2048 }),
	iconKey: varchar("icon_key", { length: 2048 }),
	iconWidth: integer("icon_width"),
	iconHeight: integer("icon_height"),
	bannerKey: varchar("banner_key", { length: 2048 }),
	bannerWidth: integer("banner_width"),
	bannerHeight: integer("banner_height"),
	gistId: varchar("gist_id", { length: 256 }).references(
		() => urlMetadataGist.gistId,
		{ onDelete: "set null" },
	),
	postId: varchar("post_id", { length: 256 }).references(
		() => urlMetadataPost.postId,
		{ onDelete: "set null" },
	),
	embedSrc: varchar("embed_src", { length: 2048 }),
	embedWidth: integer("embed_width"),
	embedHeight: integer("embed_height"),
	embedType: varchar("embed_type", { length: 64 }),
	fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
	error: boolean("error").notNull(),
});
