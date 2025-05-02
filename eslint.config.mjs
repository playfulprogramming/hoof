// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
	eslint.configs.recommended,
	tseslint.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.node,
			},
			ecmaVersion: "latest",
			sourceType: "module",
		},
	},
	{
		rules: {
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					args: "all",
					argsIgnorePattern: "^_",
					caughtErrors: "all",
					caughtErrorsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],
			"@typescript-eslint/ban-types": "off",
			"@typescript-eslint/no-empty-interface": "off",
		},
	},
);
