import * as undici from "undici";
import { env } from "@playfulprogramming/common";
import { Octokit, RequestError } from "octokit";

export const client = new Octokit({
	userAgent: env.GITHUB_REPO_OWNER,
	auth: env.GITHUB_TOKEN,
	request: {
		fetch: undici.fetch,
	},
});

export function handleRequestError(e: unknown) {
	if (e instanceof RequestError && typeof e.response?.status === "number") {
		return { status: e.response.status, data: undefined };
	}
	throw e;
}
