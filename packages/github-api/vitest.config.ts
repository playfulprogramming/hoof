import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		setupFiles: ["test-utils/setup.ts"],
		globals: true,
	},
});
