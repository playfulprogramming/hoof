import {
	pgTable,
	timestamp,
	jsonb,
	text,
	primaryKey,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
	slug: text("slug").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull().default(""),
	profileImage: text("profile_image"),
	publishedAt: timestamp("published_at", { withTimezone: true })
		.notNull()
		.$default(() => new Date()),
	meta: jsonb("meta").notNull(),
});

export const profileAchievements = pgTable(
	"profile_achievements",
	{
		profileSlug: text("profile_slug")
			.notNull()
			.references(() => profiles.slug, { onDelete: "cascade" }),
		achievementId: text("achievement_id").notNull(),
		grantedAt: timestamp("granted_at", { withTimezone: true })
			.notNull()
			.$default(() => new Date()),
	},
	(table) => [
		primaryKey({ columns: [table.profileSlug, table.achievementId] }),
	],
);

export const authorRoles = pgTable(
	"author_roles",
	{
		profileSlug: text("profile_slug")
			.notNull()
			.references(() => profiles.slug, { onDelete: "cascade" }),
		role: text("role").notNull(),
	},
	(table) => [primaryKey({ columns: [table.profileSlug, table.role] })],
);
