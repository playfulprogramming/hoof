import { pgTable, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const urlMetadata = pgTable("url_metadata", {
	id: varchar("id", { length: 32 })
		.primaryKey()
		.$defaultFn(() => sql`md5(url)`),
	url: varchar("url", { length: 2048 }).notNull(),
	title: varchar("title", { length: 2048 }),
	icon: varchar("icon", { length: 2048 }),
	banner: varchar("banner", { length: 2048 }),
});
