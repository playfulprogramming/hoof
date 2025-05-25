import { defineConfig } from "drizzle-kit";
import { env } from "@playfulprogramming/common";

export default defineConfig({
	out: "./drizzle",
	schema: "../../packages/db/src/schema/index.ts",
	dialect: "postgresql",
	casing: "snake_case",
	dbCredentials: {
		url: env.POSTGRES_URL,
	},
});
