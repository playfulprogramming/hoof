import { BRANCH_MAIN } from "@playfulprogramming/common";
import { and, eq, notInArray, or, type Column, type SQL } from "drizzle-orm";
import { Type } from "typebox";

/** Shared `?branch=` query parameter for every content route that reads from the database. */
export const BranchQueryParamSchema = Type.String({
	default: BRANCH_MAIN,
	description:
		"The content branch to read from (e.g. a PR preview branch synced from GitHub). Use `?branch=` to target a specific branch; defaults to the main branch. Content that does not exist on the requested branch falls back to the main branch.",
});

/** The branches a related-entity query reads from: the requested branch, then main as its fallback. */
export function branchesWithFallback(branch: string): string[] {
	return branch === BRANCH_MAIN ? [BRANCH_MAIN] : [branch, BRANCH_MAIN];
}

/**
 * Keeps one row per slug: the requested branch's row when there is one, otherwise main's.
 * Rows from any other branch are dropped, and the order of the remaining rows is preserved.
 * Expects at most one row per slug and branch, so filter to a single locale before calling.
 */
export function pickBranchRows<T extends { slug: string; branch: string }>(
	rows: T[],
	branch: string,
): T[] {
	const branchSlugs = new Set(
		rows.filter((row) => row.branch === branch).map((row) => row.slug),
	);
	return rows.filter(
		(row) =>
			row.branch === branch ||
			(row.branch === BRANCH_MAIN && !branchSlugs.has(row.slug)),
	);
}

/**
 * Relational `where` fragment for a list query: rows on the requested branch, or rows on main
 * whose slug is not in `branchSlugs` (the slugs that exist on the requested branch).
 */
export function branchFallbackFilter(branch: string, branchSlugs: string[]) {
	if (branch === BRANCH_MAIN) return { branch };

	const mainRows =
		branchSlugs.length > 0
			? { branch: BRANCH_MAIN, slug: { notIn: branchSlugs } }
			: { branch: BRANCH_MAIN };
	return { OR: [{ branch }, mainRows] };
}

/** The same condition as `branchFallbackFilter`, for the core query builder. */
export function branchFallbackCondition(
	table: { branch: Column; slug: Column },
	branch: string,
	branchSlugs: string[],
): SQL | undefined {
	if (branch === BRANCH_MAIN) return eq(table.branch, branch);

	const mainRows =
		branchSlugs.length > 0
			? and(eq(table.branch, BRANCH_MAIN), notInArray(table.slug, branchSlugs))
			: eq(table.branch, BRANCH_MAIN);
	return or(eq(table.branch, branch), mainRows);
}
