import { getGistById } from "@playfulprogramming/github-api";
import { mockEndpoint } from "../../../test-utils/server.ts";
import { getEmbedDataFromGist } from "./getEmbedDataFromGist.ts";
import { type Mock } from "vitest";
import {
	db,
	urlMetadataGist,
	urlMetadataGistFile,
} from "@playfulprogramming/db";

test("fetches the expected information for a successful gist response", async () => {
	const gistUrl = new URL(
		"https://gist.github.com/crutchcorn/36fe5553219c05ea38bacf1c7396085b",
	);

	mockEndpoint({
		path: "https://example.test/gist_content.txt",
		body: "Hello, world!",
	});

	(getGistById as Mock).mockReturnValueOnce(
		Promise.resolve({
			description: "This is a description of the gist.",
			files: {
				["A text file in a gist.txt"]: {
					raw_url: "https://example.test/gist_content.txt",
					language: "text",
				},
			},
		}),
	);

	(
		db.delete(urlMetadataGistFile).where(undefined).returning as Mock
	).mockReturnValueOnce(Promise.resolve([]));

	const result = await getEmbedDataFromGist(
		gistUrl,
		new AbortController().signal,
	);
	expect(result).toEqual({
		error: false,
		gistId: "36fe5553219c05ea38bacf1c7396085b",
	});

	expect(db.insert(urlMetadataGist).values).toBeCalledTimes(1);
	expect(db.insert(urlMetadataGist).values).toBeCalledWith({
		description: "This is a description of the gist.",
		gistId: "36fe5553219c05ea38bacf1c7396085b",
		username: "crutchcorn",
	});

	expect(db.insert(urlMetadataGistFile).values).toBeCalledTimes(1);
	expect(db.insert(urlMetadataGistFile).values).toBeCalledWith({
		contentKey:
			"remote-gist/36fe5553219c05ea38bacf1c7396085b/ba740aee12d1372d510bae546448ff60",
		filename: "A text file in a gist.txt",
		gistId: "36fe5553219c05ea38bacf1c7396085b",
		language: "text",
	});
});
