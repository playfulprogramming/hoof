CREATE TABLE IF NOT EXISTS "collection_authors" (
	"collection_slug" text NOT NULL,
	"author_slug" text NOT NULL,
	CONSTRAINT "collection_authors_collection_slug_author_slug_pk" PRIMARY KEY("collection_slug","author_slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_chapters" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_chapters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"locale" text NOT NULL,
	"collection_slug" text NOT NULL,
	"post_slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_data" (
	"slug" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone,
	"meta" jsonb NOT NULL,
	CONSTRAINT "collection_data_slug_locale_pk" PRIMARY KEY("slug","locale")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collections" (
	"slug" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"profile_image" text,
	"published_at" timestamp with time zone NOT NULL,
	"meta" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_authors" (
	"post_slug" text NOT NULL,
	"author_slug" text NOT NULL,
	CONSTRAINT "post_authors_post_slug_author_slug_pk" PRIMARY KEY("post_slug","author_slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_data" (
	"slug" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"version" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"social_image" text,
	"banner_image" text,
	"original_link" text,
	"noindex" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"meta" jsonb NOT NULL,
	CONSTRAINT "post_data_slug_locale_version_pk" PRIMARY KEY("slug","locale","version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"slug" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_authors" DROP CONSTRAINT IF EXISTS "collection_authors_collection_slug_collections_slug_fk";--> statement-breakpoint
ALTER TABLE "collection_authors" ADD CONSTRAINT "collection_authors_collection_slug_collections_slug_fk" FOREIGN KEY ("collection_slug") REFERENCES "public"."collections"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_authors" DROP CONSTRAINT IF EXISTS "collection_authors_author_slug_profiles_slug_fk";--> statement-breakpoint
ALTER TABLE "collection_authors" ADD CONSTRAINT "collection_authors_author_slug_profiles_slug_fk" FOREIGN KEY ("author_slug") REFERENCES "public"."profiles"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_chapters" DROP CONSTRAINT IF EXISTS "collection_chapters_collection_slug_collections_slug_fk";--> statement-breakpoint
ALTER TABLE "collection_chapters" ADD CONSTRAINT "collection_chapters_collection_slug_collections_slug_fk" FOREIGN KEY ("collection_slug") REFERENCES "public"."collections"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_chapters" DROP CONSTRAINT IF EXISTS "collection_chapters_post_slug_posts_slug_fk";--> statement-breakpoint
ALTER TABLE "collection_chapters" ADD CONSTRAINT "collection_chapters_post_slug_posts_slug_fk" FOREIGN KEY ("post_slug") REFERENCES "public"."posts"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_data" DROP CONSTRAINT IF EXISTS "collection_data_slug_collections_slug_fk";--> statement-breakpoint
ALTER TABLE "collection_data" ADD CONSTRAINT "collection_data_slug_collections_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."collections"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_authors" DROP CONSTRAINT IF EXISTS "post_authors_post_slug_posts_slug_fk";--> statement-breakpoint
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_post_slug_posts_slug_fk" FOREIGN KEY ("post_slug") REFERENCES "public"."posts"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_authors" DROP CONSTRAINT IF EXISTS "post_authors_author_slug_profiles_slug_fk";--> statement-breakpoint
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_author_slug_profiles_slug_fk" FOREIGN KEY ("author_slug") REFERENCES "public"."profiles"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_data" DROP CONSTRAINT IF EXISTS "post_data_slug_posts_slug_fk";--> statement-breakpoint
ALTER TABLE "post_data" ADD CONSTRAINT "post_data_slug_posts_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."posts"("slug") ON DELETE cascade ON UPDATE no action;