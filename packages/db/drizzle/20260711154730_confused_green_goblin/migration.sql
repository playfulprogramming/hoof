CREATE TABLE "post_attachments" (
	"post_id" uuid,
	"attachment_key" text,
	"attachment_name" text NOT NULL,
	CONSTRAINT "post_attachments_pkey" PRIMARY KEY("post_id","attachment_key")
);
--> statement-breakpoint
CREATE TABLE "post_authors" (
	"post_id" uuid,
	"author_slug" text,
	CONSTRAINT "post_authors_pkey" PRIMARY KEY("post_id","author_slug")
);
--> statement-breakpoint
CREATE TABLE "post_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"post_id" uuid,
	"tag" text,
	CONSTRAINT "post_tags_pkey" PRIMARY KEY("post_id","tag")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" text NOT NULL,
	"locale" text NOT NULL,
	"branch" text NOT NULL,
	"collection_slug" text,
	"collection_order" integer DEFAULT 0 NOT NULL,
	"group_id" uuid,
	"version_name" text DEFAULT '' NOT NULL,
	"version_order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"social_image" text,
	"banner_image" text,
	"original_link" text,
	"noindex" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"meta" jsonb NOT NULL,
	CONSTRAINT "posts_slug_locale_branch_unique" UNIQUE("slug","locale","branch")
);
--> statement-breakpoint
ALTER TABLE "post_attachments" ADD CONSTRAINT "post_attachments_post_id_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_attachments" ADD CONSTRAINT "post_attachments_attachment_key_attachments_attachment_key_fkey" FOREIGN KEY ("attachment_key") REFERENCES "attachments"("attachment_key") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_post_id_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_author_slug_profiles_slug_fkey" FOREIGN KEY ("author_slug") REFERENCES "profiles"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_collection_slug_collections_slug_fkey" FOREIGN KEY ("collection_slug") REFERENCES "collections"("slug") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_group_id_post_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "post_groups"("id") ON DELETE CASCADE;