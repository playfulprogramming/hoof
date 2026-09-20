import { defineConfig } from "vite";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import { nxCopyAssetsPlugin } from "@nx/vite/plugins/nx-copy-assets.plugin";

export default defineConfig(() => ({
	root: import.meta.dirname,
	cacheDir: "../../node_modules/.vite/apps/e2e",
	plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(["*.md"])],
	test: {
		name: "e2e",
		watch: false,
		globals: true,
		environment: "node",
		include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		reporters: ["default"],
		coverage: {
			reportsDirectory: "coverage",
			provider: "v8" as const,
		},
	},
}));
