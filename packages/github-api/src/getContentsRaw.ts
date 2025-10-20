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

export async function getContentsRaw(
	params: GetContentsParams,
): Promise<string> {
	const response = await getContentsRawBase(params, "text");
	const data = response.data;

	if (typeof data === "undefined" || response.error) {
		throw new Error(
			`GitHub API (${response.response.url}) returned ${response.response.status} ${response.error}`,
		);
	}

	return data;
}

export async function getContentsRawStream(
	params: GetContentsParams,
): Promise<ReadableStream<Uint8Array>> {
	const response = await getContentsRawBase(params, "stream");
	const data = response.data;

	if (typeof data === "undefined" || data === null || response.error) {
		throw new Error(
			`GitHub API (getContentsRawStream) returned ${response.response.status} ${response.error}`,
		);
	}

	return data;
}
