import { clientWithType } from "./client.ts";

export interface GetContentsParams {
	path: string;
	ref: string;
	repoOwner: string;
	repoName: string;
	signal?: AbortSignal;
}

export async function getContents(params: GetContentsParams) {
	return await clientWithType("application/vnd.github.object").GET(
		"/repos/{owner}/{repo}/contents/{path}",
		{
			params: {
				query: {
					ref: params.ref,
				},
				path: {
					owner: params.repoOwner,
					repo: params.repoName,
					path: params.path,
				},
			},
			headers: {
				Accept: "application/vnd.github.object+json",
			},
			signal: params.signal,
		},
	);
}
