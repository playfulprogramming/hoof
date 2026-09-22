import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globalSetup: "test-utils/globalSetup.ts",
		setupFiles: ["test-utils/setup.ts"],
		watch: false,
		globals: true,
		fileParallelism: false,
		maxWorkers: 1,
	},
});
