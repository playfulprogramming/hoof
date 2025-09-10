import { createRequire } from "node:module";

/**
 * Workaround for https://github.com/vitest-dev/vitest/issues/6953 (fixed, but not in a vitest release)
 * Behaves the same as import.meta.resolve, but without the "file://" prefix.
 */
export const importMetaResolve = (specifier: string) =>
	createRequire(import.meta.url).resolve(specifier);
