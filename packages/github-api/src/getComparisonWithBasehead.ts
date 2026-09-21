import type { Octokit } from "octokit";

export interface GetComparisonWithBaseheadParams {
	owner: string;
	repo: string;
	baseSha: string;
	headSha: string;
	signal: AbortSignal;
}

export async function getComparisonWithBasehead(
	client: Octokit,
	params: GetComparisonWithBaseheadParams,
) {
	const response = await client.rest.repos.compareCommitsWithBasehead({
		owner: params.owner,
		repo: params.repo,
		basehead: `${params.baseSha}..${params.headSha}`,
		request: {
			signal: params.signal,
		},
	});
	return response.data;
}
