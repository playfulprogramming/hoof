import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "../../.env") });

export default defineConfig({
	out: "./drizzle",
	schema: "./src/schema/index.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.POSTGRES_URL!,
	},
});
