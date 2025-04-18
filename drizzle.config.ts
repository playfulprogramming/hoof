import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/shared_lib/plugins/db/schemas",
	casing: "snake_case",
});
