CREATE TABLE "author_roles" (
	"profile_slug" text,
	"role" text,
	CONSTRAINT "author_roles_pkey" PRIMARY KEY("profile_slug","role")
);
--> statement-breakpoint
ALTER TABLE "author_roles" ADD CONSTRAINT "author_roles_profile_slug_profiles_slug_fkey" FOREIGN KEY ("profile_slug") REFERENCES "profiles"("slug") ON DELETE CASCADE;