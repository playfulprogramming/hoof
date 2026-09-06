import { pgTable, bigint, uuid } from "drizzle-orm/pg-core";

export const githubInstallations = pgTable("github_installations", {
	id: uuid().primaryKey().defaultRandom(),
	installationId: bigint("installation_id", { mode: "number" }).notNull(),
});
