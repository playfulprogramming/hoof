import { clientWithType } from "./client.ts";

export interface GetGistByIdParams {
	gistId: string;
	signal?: AbortSignal;
}

export async function getGistById(params: GetGistByIdParams) {
	const response = await clientWithType("application/json").GET(
		"/gists/{gist_id}",
		{
			params: {
				path: {
					gist_id: params.gistId,
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
