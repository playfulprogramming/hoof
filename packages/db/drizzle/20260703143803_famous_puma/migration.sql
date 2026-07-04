CREATE TABLE "collection_tags" (
	"collection_slug" text,
	"tag" text,
	CONSTRAINT "collection_tags_pkey" PRIMARY KEY("collection_slug","tag")
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"post_slug" text,
	"tag" text,
	CONSTRAINT "post_tags_pkey" PRIMARY KEY("post_slug","tag")
);
--> statement-breakpoint
ALTER TABLE "collection_tags" ADD CONSTRAINT "collection_tags_collection_slug_collections_slug_fkey" FOREIGN KEY ("collection_slug") REFERENCES "collections"("slug") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_slug_posts_slug_fkey" FOREIGN KEY ("post_slug") REFERENCES "posts"("slug") ON DELETE CASCADE;