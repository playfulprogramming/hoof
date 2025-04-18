import eslint from "@eslint/js";
import * as tseslint from "typescript-eslint";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pfpTypeScriptRules = {
	"@typescript-eslint/ban-types": "off",
	"@typescript-eslint/no-empty-interface": "off",
	"@typescript-eslint/no-unused-vars": "off",
};

export default tseslint.config(
	// Base ignores
	{
		ignores: [
			"**/node_modules/**",
			"**/dist/**",
			"**/package-lock.json",
			"**/*.min.js",
		],
	},

	// Base configs
	eslint.configs.recommended,
	...tseslint.configs.recommended,

	// Global settings
	{
		languageOptions: {
			globals: {
				...globals.node,
			},
			ecmaVersion: "latest",
			sourceType: "module",
		},
		rules: {
			"no-unused-vars": "off",
			"no-mixed-spaces-and-tabs": "off",
			"no-useless-escape": "off",
		},
	},

	// TypeScript configuration
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: __dirname,
			},
		},
		rules: pfpTypeScriptRules,
	}
);
