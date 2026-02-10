CREATE TABLE IF NOT EXISTS "post_images" (
	"slug" varchar(2048) PRIMARY KEY NOT NULL,
	"banner_key" varchar(2048) NOT NULL,
	"link_preview_key" varchar(2048) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "url_metadata" (
	"url" varchar(2048) PRIMARY KEY NOT NULL,
	"title" varchar(2048),
	"icon_key" varchar(2048),
	"icon_width" integer,
	"icon_height" integer,
	"banner_key" varchar(2048),
	"banner_width" integer,
	"banner_height" integer,
	"fetched_at" timestamp with time zone NOT NULL,
	"error" boolean NOT NULL
);
