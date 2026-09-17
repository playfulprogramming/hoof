CREATE TABLE "author_slugs" (
	"slug" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "collection_slugs" (
	"slug" text PRIMARY KEY
);
--> statement-breakpoint
ALTER TABLE "collection_authors" DROP CONSTRAINT "collection_authors_collection_slug_collections_slug_fk";--> statement-breakpoint
ALTER TABLE "collection_authors" DROP CONSTRAINT "collection_authors_author_slug_profiles_slug_fk";--> statement-breakpoint
ALTER TABLE "collection_tags" DROP CONSTRAINT "collection_tags_collection_slug_collections_slug_fkey";--> statement-breakpoint
ALTER TABLE "post_authors" DROP CONSTRAINT "post_authors_author_slug_profiles_slug_fkey";--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_collection_slug_collections_slug_fkey";--> statement-breakpoint
ALTER TABLE "author_achievements" DROP CONSTRAINT "profile_achievements_profile_slug_profiles_slug_fkey";--> statement-breakpoint
ALTER TABLE "author_roles" DROP CONSTRAINT "author_roles_profile_slug_profiles_slug_fkey";--> statement-breakpoint
DROP TABLE "collection_data";--> statement-breakpoint
ALTER TABLE "collection_authors" DROP CONSTRAINT "collection_authors_collection_slug_author_slug_pk";--> statement-breakpoint
ALTER TABLE "authors" DROP CONSTRAINT "profiles_pkey";--> statement-breakpoint
ALTER TABLE "authors" ADD COLUMN "id" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "authors" ADD COLUMN "branch" text NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_authors" ADD COLUMN "collection_id" uuid;--> statement-breakpoint
ALTER TABLE "collection_tags" ADD COLUMN "collection_id" uuid;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "id" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "locale" text NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "branch" text NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "meta" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "cover_image" text;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "social_image" text;--> statement-breakpoint
ALTER TABLE "collection_authors" ADD PRIMARY KEY ("collection_id","author_slug");--> statement-breakpoint
ALTER TABLE "authors" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "collection_authors" DROP COLUMN "collection_slug";--> statement-breakpoint
ALTER TABLE "collection_tags" DROP COLUMN "collection_slug";--> statement-breakpoint
ALTER TABLE "collection_tags" ADD PRIMARY KEY ("collection_id","tag");--> statement-breakpoint
ALTER TABLE "collections" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "authors" ADD CONSTRAINT "authors_slug_branch_unique" UNIQUE("slug","branch");--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_slug_locale_branch_unique" UNIQUE("slug","locale","branch");--> statement-breakpoint
ALTER TABLE "authors" ADD CONSTRAINT "authors_slug_author_slugs_slug_fkey" FOREIGN KEY ("slug") REFERENCES "author_slugs"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_authors" ADD CONSTRAINT "collection_authors_collection_id_collections_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_authors" ADD CONSTRAINT "collection_authors_author_slug_author_slugs_slug_fkey" FOREIGN KEY ("author_slug") REFERENCES "author_slugs"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_tags" ADD CONSTRAINT "collection_tags_collection_id_collections_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_slug_collection_slugs_slug_fkey" FOREIGN KEY ("slug") REFERENCES "collection_slugs"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_author_slug_author_slugs_slug_fkey" FOREIGN KEY ("author_slug") REFERENCES "author_slugs"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_collection_slug_collection_slugs_slug_fkey" FOREIGN KEY ("collection_slug") REFERENCES "collection_slugs"("slug") ON DELETE SET NULL;