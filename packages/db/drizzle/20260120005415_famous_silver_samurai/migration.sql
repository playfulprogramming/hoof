ALTER TABLE "collection_chapters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "collection_chapters" CASCADE;--> statement-breakpoint
ALTER TABLE "collection_data" ADD COLUMN IF NOT EXISTS "cover_image" text;--> statement-breakpoint
ALTER TABLE "collection_data" ADD COLUMN IF NOT EXISTS "social_image" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "collection_slug" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "collection_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_collection_slug_collections_slug_fk";--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_collection_slug_collections_slug_fk" FOREIGN KEY ("collection_slug") REFERENCES "public"."collections"("slug") ON DELETE set null ON UPDATE no action;