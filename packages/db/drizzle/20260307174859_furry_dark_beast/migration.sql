CREATE TABLE "url_metadata_gist" (
	"gist_id" varchar(256) PRIMARY KEY,
	"username" varchar(256) NOT NULL,
	"description" varchar(2048)
);
--> statement-breakpoint
CREATE TABLE "url_metadata_gist_file" (
	"gist_id" varchar(256),
	"filename" varchar(256),
	"content_key" varchar(256) NOT NULL,
	"language" varchar(16) NOT NULL,
	CONSTRAINT "url_metadata_gist_file_pkey" PRIMARY KEY("gist_id","filename")
);
--> statement-breakpoint
CREATE TABLE "url_metadata_post" (
	"post_id" varchar(256) PRIMARY KEY,
	"author_name" varchar(2048) NOT NULL,
	"author_handle" varchar(2048) NOT NULL,
	"content" varchar(2048) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"avatar_key" varchar(256),
	"avatar_width" integer,
	"avatar_height" integer,
	"image_key" varchar(256),
	"image_width" integer,
	"image_height" integer,
	"image_alt_text" varchar(2048),
	"num_likes" integer,
	"num_reposts" integer,
	"num_replies" integer,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "url_metadata" ADD COLUMN "gist_id" varchar(256);--> statement-breakpoint
ALTER TABLE "url_metadata" ADD COLUMN "post_id" varchar(256);--> statement-breakpoint
ALTER TABLE "url_metadata" ADD COLUMN "embed_src" varchar(2048);--> statement-breakpoint
ALTER TABLE "url_metadata" ADD COLUMN "embed_width" integer;--> statement-breakpoint
ALTER TABLE "url_metadata" ADD COLUMN "embed_height" integer;--> statement-breakpoint
ALTER TABLE "url_metadata" ADD COLUMN "embed_type" varchar(64);--> statement-breakpoint
ALTER TABLE "url_metadata" ADD CONSTRAINT "url_metadata_gist_id_url_metadata_gist_gist_id_fkey" FOREIGN KEY ("gist_id") REFERENCES "url_metadata_gist"("gist_id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "url_metadata" ADD CONSTRAINT "url_metadata_post_id_url_metadata_post_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "url_metadata_post"("post_id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "url_metadata_gist_file" ADD CONSTRAINT "url_metadata_gist_file_gist_id_url_metadata_gist_gist_id_fkey" FOREIGN KEY ("gist_id") REFERENCES "url_metadata_gist"("gist_id") ON DELETE CASCADE;