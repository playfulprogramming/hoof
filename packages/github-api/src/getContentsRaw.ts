import { client } from "./client.ts";
import type { GetContentsParams } from "./getContents.ts";

function getContentsRawBase<T extends "text" | "stream">(
	params: GetContentsParams,
	parseAs: T,
) {
	return client.GET("/repos/{owner}/{repo}/contents/{path}", {
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
		parseAs,
		signal: params.signal,
	});
}

export function getContentsRaw(params: GetContentsParams) {
	return getContentsRawBase(params, "text");
}

export async function getContentsRawStream(params: GetContentsParams) {
	return getContentsRawBase(params, "stream");
}
