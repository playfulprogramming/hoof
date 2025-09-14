import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		retry: 1,
		testTimeout: 15_000,
	},
});
