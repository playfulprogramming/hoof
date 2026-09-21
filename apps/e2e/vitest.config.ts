import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		setupFiles: ["test-utils/setup.ts"],
		watch: false,
		globals: true,
		fileParallelism: false,
		maxWorkers: 1,
	},
});
