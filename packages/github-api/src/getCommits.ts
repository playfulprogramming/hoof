import { client } from "./client.ts";

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
	const response = await client.rest.repos.listCommits({
		sha: params.sha,
		path: params.path,
		owner: params.repoOwner,
		repo: params.repoName,
		request: {
			signal: params.signal,
		},
	});

	return response.data;
}
