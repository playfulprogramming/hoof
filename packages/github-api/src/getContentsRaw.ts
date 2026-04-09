import { Response } from "undici";
import { client, handleRequestError } from "./client.ts";
import type { GetContentsParams } from "./getContents.ts";

export async function getContentsRawStream(params: GetContentsParams) {
	const response = await client.rest.repos
		.getContent({
			ref: params.ref,
			owner: params.repoOwner,
			repo: params.repoName,
			path: params.path,
			mediaType: {
				format: "raw",
			},
			request: {
				parseSuccessResponseBody: false,
				signal: params.signal,
			},
		})
		.catch(handleRequestError);

	if (response.data !== undefined) {
		return {
			status: 200,
			data: response.data as unknown as ReadableStream,
		};
	} else return response;
}

export async function getContentsRaw(params: GetContentsParams) {
	const response = await getContentsRawStream(params);
	if (response.data !== undefined) {
		return {
			status: 200,
			data: await new Response(response.data).text(),
		};
	} else return response;
}
