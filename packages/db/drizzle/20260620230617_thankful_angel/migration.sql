CREATE TABLE "profile_achievements" (
	"profile_slug" text,
	"achievement_id" text,
	"granted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "profile_achievements_pkey" PRIMARY KEY("profile_slug","achievement_id")
);
--> statement-breakpoint
ALTER TABLE "profile_achievements" ADD CONSTRAINT "profile_achievements_profile_slug_profiles_slug_fkey" FOREIGN KEY ("profile_slug") REFERENCES "profiles"("slug") ON DELETE CASCADE;