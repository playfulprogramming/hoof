import { BRANCH_MAIN } from "@playfulprogramming/common";
import { PgDialect, pgTable, text } from "drizzle-orm/pg-core";
import {
	branchFallbackCondition,
	branchFallbackFilter,
	branchesWithFallback,
	pickBranchRows,
} from "./common.ts";

const PR_BRANCH = "pull/42";
const OTHER_BRANCH = "pull/7";

describe("branchesWithFallback", () => {
	test("returns only main when main is requested", () => {
		expect(branchesWithFallback(BRANCH_MAIN)).toEqual([BRANCH_MAIN]);
	});

	test("returns the requested branch followed by main", () => {
		expect(branchesWithFallback(PR_BRANCH)).toEqual([PR_BRANCH, BRANCH_MAIN]);
	});
});

describe("pickBranchRows", () => {
	test("the requested branch's row wins over main's", () => {
		const rows = [
			{ slug: "example-post", branch: BRANCH_MAIN, title: "Main title" },
			{ slug: "example-post", branch: PR_BRANCH, title: "PR title" },
		];

		expect(pickBranchRows(rows, PR_BRANCH)).toEqual([
			{ slug: "example-post", branch: PR_BRANCH, title: "PR title" },
		]);
	});

	test("main's row is used when the requested branch has no row", () => {
		const rows = [
			{ slug: "example-post", branch: BRANCH_MAIN, title: "Main title" },
		];

		expect(pickBranchRows(rows, PR_BRANCH)).toEqual(rows);
	});

	test("a third branch's row is never returned", () => {
		const rows = [
			{ slug: "only-elsewhere", branch: OTHER_BRANCH },
			{ slug: "example-post", branch: OTHER_BRANCH },
			{ slug: "example-post", branch: BRANCH_MAIN },
		];

		expect(pickBranchRows(rows, PR_BRANCH)).toEqual([
			{ slug: "example-post", branch: BRANCH_MAIN },
		]);
	});

	test("returns one row per slug", () => {
		const rows = [
			{ slug: "first", branch: BRANCH_MAIN },
			{ slug: "first", branch: PR_BRANCH },
			{ slug: "first", branch: OTHER_BRANCH },
			{ slug: "second", branch: BRANCH_MAIN },
			{ slug: "third", branch: PR_BRANCH },
		];

		const picked = pickBranchRows(rows, PR_BRANCH);

		expect(picked.map((row) => row.slug)).toEqual(["first", "second", "third"]);
	});

	test("keeps each picked row at its own position in the input order", () => {
		const rows = [
			{ slug: "moved", branch: BRANCH_MAIN },
			{ slug: "unchanged", branch: BRANCH_MAIN },
			{ slug: "moved", branch: PR_BRANCH },
		];

		expect(pickBranchRows(rows, PR_BRANCH)).toEqual([
			{ slug: "unchanged", branch: BRANCH_MAIN },
			{ slug: "moved", branch: PR_BRANCH },
		]);
	});

	test("returns only main's rows when main is requested", () => {
		const rows = [
			{ slug: "example-post", branch: PR_BRANCH },
			{ slug: "example-post", branch: BRANCH_MAIN },
		];

		expect(pickBranchRows(rows, BRANCH_MAIN)).toEqual([
			{ slug: "example-post", branch: BRANCH_MAIN },
		]);
	});
});

describe("branchFallbackFilter", () => {
	test("filters to main alone when main is requested", () => {
		expect(branchFallbackFilter(BRANCH_MAIN, [])).toEqual({
			branch: BRANCH_MAIN,
		});
	});

	test("matches the requested branch, or main rows whose slug is not on it", () => {
		expect(branchFallbackFilter(PR_BRANCH, ["first", "second"])).toEqual({
			OR: [
				{ branch: PR_BRANCH },
				{ branch: BRANCH_MAIN, slug: { notIn: ["first", "second"] } },
			],
		});
	});

	test("omits the slug condition when the requested branch has no rows", () => {
		expect(branchFallbackFilter(PR_BRANCH, [])).toEqual({
			OR: [{ branch: PR_BRANCH }, { branch: BRANCH_MAIN }],
		});
	});
});

describe("branchFallbackCondition", () => {
	const example = pgTable("example", {
		slug: text("slug").notNull(),
		branch: text("branch").notNull(),
	});

	const toQuery = (branch: string, branchSlugs: string[]) =>
		new PgDialect().sqlToQuery(
			branchFallbackCondition(example, branch, branchSlugs)!,
		);

	test("filters to main alone when main is requested", () => {
		expect(toQuery(BRANCH_MAIN, [])).toMatchObject({
			sql: `"example"."branch" = $1`,
			params: [BRANCH_MAIN],
		});
	});

	test("matches the requested branch, or main rows whose slug is not on it", () => {
		expect(toQuery(PR_BRANCH, ["first", "second"])).toMatchObject({
			sql: `(("example"."branch" = $1) or ((("example"."branch" = $2) and ("example"."slug" not in ($3, $4)))))`,
			params: [PR_BRANCH, BRANCH_MAIN, "first", "second"],
		});
	});

	test("omits the slug condition when the requested branch has no rows", () => {
		expect(toQuery(PR_BRANCH, [])).toMatchObject({
			sql: `(("example"."branch" = $1) or ("example"."branch" = $2))`,
			params: [PR_BRANCH, BRANCH_MAIN],
		});
	});
});
