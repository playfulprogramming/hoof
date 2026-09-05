ALTER TABLE "profile_achievements" RENAME TO "author_achievements";--> statement-breakpoint
ALTER TABLE "profiles" RENAME TO "authors";--> statement-breakpoint
ALTER TABLE "author_achievements" RENAME COLUMN "profile_slug" TO "author_slug";--> statement-breakpoint
ALTER TABLE "author_roles" RENAME COLUMN "profile_slug" TO "author_slug";