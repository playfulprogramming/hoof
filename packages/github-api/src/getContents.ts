import { client, handleRequestError } from "./client.ts";

export interface GetContentsParams {
	path: string;
	ref: string;
	repoOwner: string;
	repoName: string;
	signal?: AbortSignal;
}

export async function getContents(params: GetContentsParams) {
	const response = await client.rest.repos
		.getContent({
			ref: params.ref,
			path: params.path,
			owner: params.repoOwner,
			repo: params.repoName,
			mediaType: {
				format: "object",
			},
			request: {
				signal: params.signal,
			},
		})
		.then((r) => {
			type Entry = Extract<typeof r.data, Array<unknown>>[number];
			type DirEntry = Omit<Entry, "type"> & {
				type: "dir";
				entries: Array<Entry>;
			};
			type NonDirEntry = Omit<Entry, "type"> & {
				type: "file" | "submodule" | "symlink";
				entries: undefined;
			};
			const data = r.data as unknown as DirEntry | NonDirEntry;
			return { ...r, data };
		})
		.catch(handleRequestError);

	return response;
}
