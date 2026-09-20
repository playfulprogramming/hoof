CREATE TABLE "collection_attachments" (
	"collection_id" uuid,
	"attachment_key" text NOT NULL,
	"attachment_name" text,
	CONSTRAINT "collection_attachments_pkey" PRIMARY KEY("collection_id","attachment_name")
);
--> statement-breakpoint
ALTER TABLE "post_attachments" DROP CONSTRAINT "post_attachments_pkey";--> statement-breakpoint
ALTER TABLE "post_attachments" ADD PRIMARY KEY ("post_id","attachment_name");--> statement-breakpoint
ALTER TABLE "collection_attachments" ADD CONSTRAINT "collection_attachments_collection_id_collections_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_attachments" ADD CONSTRAINT "collection_attachments_g9eTQ7e0aeKo_fkey" FOREIGN KEY ("attachment_key") REFERENCES "attachments"("attachment_key") ON DELETE CASCADE;