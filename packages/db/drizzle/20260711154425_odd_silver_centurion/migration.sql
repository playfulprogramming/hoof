CREATE TABLE "attachments" (
	"attachment_key" text PRIMARY KEY,
	"sha" text NOT NULL,
	"width" integer,
	"height" integer
);
--> statement-breakpoint
ALTER TABLE "post_authors" DROP CONSTRAINT "post_authors_post_slug_posts_slug_fk";--> statement-breakpoint
ALTER TABLE "post_data" DROP CONSTRAINT "post_data_slug_posts_slug_fk";--> statement-breakpoint
ALTER TABLE "post_tags" DROP CONSTRAINT "post_tags_post_slug_posts_slug_fkey";--> statement-breakpoint
ALTER TABLE "post_attachments" DROP CONSTRAINT "post_attachments_post_slug_posts_slug_fkey";--> statement-breakpoint
DROP TABLE "post_authors";--> statement-breakpoint
DROP TABLE "post_data";--> statement-breakpoint
DROP TABLE "posts";--> statement-breakpoint
DROP TABLE "post_tags";--> statement-breakpoint
DROP TABLE "post_attachments";--> statement-breakpoint
