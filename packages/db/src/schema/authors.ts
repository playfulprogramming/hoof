import {
	pgTable,
	timestamp,
	jsonb,
	text,
	primaryKey,
	uuid,
	unique,
} from "drizzle-orm/pg-core";

export const authorSlugs = pgTable("author_slugs", {
	slug: text("slug").primaryKey(),
});

export const authors = pgTable(
	"authors",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		slug: text("slug")
			.notNull()
			.references(() => authorSlugs.slug, { onDelete: "cascade" }),
		branch: text("branch").notNull(),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
		profileImage: text("profile_image"),
		publishedAt: timestamp("published_at", { withTimezone: true })
			.notNull()
			.$default(() => new Date()),
		meta: jsonb("meta").notNull(),
	},
	(table) => [unique().on(table.slug, table.branch)],
);

export const authorAchievements = pgTable(
	"author_achievements",
	{
		authorSlug: text("author_slug").notNull(),
		achievementId: text("achievement_id").notNull(),
		grantedAt: timestamp("granted_at", { withTimezone: true })
			.notNull()
			.$default(() => new Date()),
	},
	(table) => [primaryKey({ columns: [table.authorSlug, table.achievementId] })],
);

export const authorRoles = pgTable(
	"author_roles",
	{
		authorSlug: text("author_slug").notNull(),
		role: text("role").notNull(),
	},
	(table) => [primaryKey({ columns: [table.authorSlug, table.role] })],
);
