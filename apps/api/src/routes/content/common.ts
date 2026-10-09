import { BRANCH_MAIN } from "@playfulprogramming/common";
import { Type } from "typebox";

/** Shared `?branch=` query parameter for every content route that reads from the database. */
export const BranchQueryParamSchema = Type.String({
	default: BRANCH_MAIN,
	description:
		"The content branch to read from (e.g. a PR preview branch synced from GitHub). Use `?branch=` to target a specific branch; defaults to the main branch.",
});
