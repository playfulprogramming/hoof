import { clientWithType } from "./client.ts";

export interface GetCommitsParams {
	/** Only commits containing this file path will be returned. */
	path?: string;
	/** SHA or branch to start listing commits from. */
	sha: string;
	repoOwner: string;
	repoName: string;
	signal?: AbortSignal;
}

export async function getCommits(params: GetCommitsParams) {
	const response = await clientWithType("application/json").GET(
		"/repos/{owner}/{repo}/commits",
		{
			params: {
				query: {
					sha: params.sha,
					path: params.path,
				},
				path: {
					owner: params.repoOwner,
					repo: params.repoName,
				},
			},
			headers: {
				Accept: "application/vnd.github+json",
			},
			signal: params.signal,
		},
	);

	const data = response.data;

	if (typeof data === "undefined" || response.error) {
		throw new Error(
			`GitHub API (getCommits) returned ${response.response.status} ${response.error}`,
		);
	}

	return data;
}
