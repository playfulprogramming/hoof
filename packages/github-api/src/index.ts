import type { Octokit } from "octokit";
import { app, localClient, createOctokit } from "./client.ts";
import { getAuthorGitHubStats } from "./getAuthorGitHubStats.ts";
import { getContents } from "./getContents.ts";
import { getContentsRaw, getContentsRawStream } from "./getContentsRaw.ts";
import { getGistById } from "./getGistById.ts";
import { getTree } from "./getTree.ts";

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
		getContents: injectClient(client, getContents),
		getContentsRawStream: injectClient(client, getContentsRawStream),
		getContentsRaw: injectClient(client, getContentsRaw),
		getGistById: injectClient(client, getGistById),
		getTree: injectClient(client, getTree),
	};
}

export function createAppClient() {
	if (localClient) return createClient(localClient);
	return createClient(app.octokit);
}

export async function createInstallationClient(installationId?: number) {
	if (typeof installationId !== "undefined") {
		return createClient(await createOctokit(installationId));
	} else {
		return createAppClient();
	}
}
