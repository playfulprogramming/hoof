import { pgTable, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestampsInDB } from "./timestamps.ts";

export const urlMetadataInDB = pgTable("url_metadata", {
	id: varchar("id", { length: 32 })
		.primaryKey()
		.$defaultFn(() => sql`md5(url)`),
	url: varchar("url", { length: 2048 }).notNull(),
	icon: varchar("icon", { length: 2048 }),
	banner: varchar("banner", { length: 2048 }),
	...timestampsInDB,
});
