import type { Octokit } from "octokit";

export interface GetTreeParams {
	treeSha: string;
	repoOwner: string;
	repoName: string;
	signal?: AbortSignal;
}

export async function getTree(client: Octokit, params: GetTreeParams) {
	const response = await client.request(
		"GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
		{
			owner: params.repoOwner,
			repo: params.repoName,
			tree_sha: params.treeSha,
			request: {
				signal: params.signal,
			},
		},
	);
	return response.data;
}
