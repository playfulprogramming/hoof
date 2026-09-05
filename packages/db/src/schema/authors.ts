import {
	pgTable,
	timestamp,
	jsonb,
	text,
	primaryKey,
} from "drizzle-orm/pg-core";

export const authors = pgTable("authors", {
	slug: text("slug").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull().default(""),
	profileImage: text("profile_image"),
	publishedAt: timestamp("published_at", { withTimezone: true })
		.notNull()
		.$default(() => new Date()),
	meta: jsonb("meta").notNull(),
});

export const authorAchievements = pgTable(
	"author_achievements",
	{
		authorSlug: text("author_slug")
			.notNull()
			.references(() => authors.slug, { onDelete: "cascade" }),
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
		authorSlug: text("author_slug")
			.notNull()
			.references(() => authors.slug, { onDelete: "cascade" }),
		role: text("role").notNull(),
	},
	(table) => [primaryKey({ columns: [table.authorSlug, table.role] })],
);
