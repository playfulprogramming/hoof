import type { Octokit } from "octokit";
import { publicOctokit, createOctokit } from "./client.ts";
import { getAuthorGitHubStats } from "./getAuthorGitHubStats.ts";
import { getContents } from "./getContents.ts";
import { getContentsRaw, getContentsRawStream } from "./getContentsRaw.ts";
import { getGistById } from "./getGistById.ts";
import { getTree } from "./getTree.ts";
import { getComparisonWithBasehead } from "./getComparisonWithBasehead.ts";

export * from "./contributorYears.ts";
export * as webhooks from "./webhooks.ts";

function injectClient<T extends unknown[], R>(
	client: Octokit,
	func: (client: Octokit, ...args: T) => R,
): (...args: T) => R {
	return (...args) => func(client, ...args);
}

function createClient(client: Octokit) {
	return {
		getAuthorGitHubStats: injectClient(client, getAuthorGitHubStats),
		getComparisonWithBasehead: injectClient(client, getComparisonWithBasehead),
		getContents: injectClient(client, getContents),
		getContentsRawStream: injectClient(client, getContentsRawStream),
		getContentsRaw: injectClient(client, getContentsRaw),
		getGistById: injectClient(client, getGistById),
		getTree: injectClient(client, getTree),
	};
}

export type GitHubClient = ReturnType<typeof createClient>;

export const publicClient = createClient(publicOctokit);

export async function createInstallationClient(installationId: number) {
	return createClient(await createOctokit(installationId));
}
