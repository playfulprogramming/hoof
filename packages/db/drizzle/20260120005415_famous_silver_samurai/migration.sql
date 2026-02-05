ALTER TABLE "collection_chapters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "collection_chapters" CASCADE;--> statement-breakpoint
ALTER TABLE "collection_data" ADD COLUMN "cover_image" text;--> statement-breakpoint
ALTER TABLE "collection_data" ADD COLUMN "social_image" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "collection_slug" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "collection_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_collection_slug_collections_slug_fk" FOREIGN KEY ("collection_slug") REFERENCES "public"."collections"("slug") ON DELETE set null ON UPDATE no action;