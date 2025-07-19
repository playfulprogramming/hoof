ALTER TABLE "post_images" ALTER COLUMN "banner_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "post_images" ALTER COLUMN "link_preview_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "post_images" ADD COLUMN "index_md5" varchar(2048);--> statement-breakpoint
ALTER TABLE "post_images" ADD COLUMN "fetched_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "post_images" ADD COLUMN "error" boolean NOT NULL;