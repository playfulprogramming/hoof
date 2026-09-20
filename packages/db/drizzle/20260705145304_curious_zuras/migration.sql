CREATE TABLE "post_attachments" (
	"post_slug" text,
	"attachment_name" text,
	"attachment_key" text NOT NULL,
	"width" integer,
	"height" integer,
	CONSTRAINT "post_attachments_pkey" PRIMARY KEY("post_slug","attachment_name")
);
--> statement-breakpoint
ALTER TABLE "post_attachments" ADD CONSTRAINT "post_attachments_post_slug_posts_slug_fkey" FOREIGN KEY ("post_slug") REFERENCES "posts"("slug") ON DELETE CASCADE;