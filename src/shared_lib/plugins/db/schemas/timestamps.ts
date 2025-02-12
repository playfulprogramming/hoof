import { timestamp } from "drizzle-orm/pg-core";

export const timestampsInDB = {
	updatedAt: timestamp("updated_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	deletedAt: timestamp("deleted_at"),
};
