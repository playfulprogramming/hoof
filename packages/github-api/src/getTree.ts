import { clientWithType } from "./client.ts";

export interface GetTreeParams {
	treeSha: string;
	repoOwner: string;
	repoName: string;
}

export async function getTree(params: GetTreeParams) {
	const response = await clientWithType("application/json").GET(
		"/repos/{owner}/{repo}/git/trees/{tree_sha}",
		{
			params: {
				path: {
					owner: params.repoOwner,
					repo: params.repoName,
					tree_sha: params.treeSha,
				},
			},
			headers: {
				Accept: "application/vnd.github+json",
			},
		},
	);

	const data = response.data;

	if (typeof data === "undefined" || response.error) {
		throw new Error(
			`GitHub API (getContents) returned ${response.response.status} ${response.error}`,
		);
	}

	return data;
}
