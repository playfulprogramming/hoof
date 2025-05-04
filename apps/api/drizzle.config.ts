import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle",
	schema: "../../packages/db/src/schema/index.ts",
	dialect: "postgresql",
	casing: "snake_case",
	dbCredentials: {
		url: process.env.POSTGRES_URL!,
	},
});
