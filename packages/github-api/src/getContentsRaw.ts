import { client } from "./client.ts";
import type { GetContentsParams } from "./getContents.ts";

export async function getContentsRaw(
	params: GetContentsParams,
): Promise<string> {
	const response = await client.GET("/repos/{owner}/{repo}/contents/{path}", {
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
			Accept: "application/vnd.github.raw+json",
		},
		parseAs: "text",
	});

	const data = response.data;

	if (typeof data === "undefined" || response.error) {
		throw new Error(
			`GitHub API (getContentsRaw) returned ${response.response.status} ${response.error}`,
		);
	}

	return data;
}
