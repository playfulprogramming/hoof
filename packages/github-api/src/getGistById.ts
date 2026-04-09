import { client } from "./client.ts";

export interface GetGistByIdParams {
	gistId: string;
	signal?: AbortSignal;
}

export async function getGistById(params: GetGistByIdParams) {
	const response = await client.rest.gists.get({
		gist_id: params.gistId,
		request: {
			signal: params.signal,
		},
	});
	return response.data;
}
