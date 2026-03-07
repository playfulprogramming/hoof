import {
	db,
	urlMetadataGist,
	urlMetadataGistFile,
} from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import { fetchAsBot } from "../../utils/fetchAsBot.ts";
import * as github from "@playfulprogramming/github-api";
import { and, eq, inArray, not } from "drizzle-orm";
import { type EmbedData, BUCKET } from "./common.ts";
import * as crypto from "crypto";

export const gistHosts = ["gist.github.com"];

export async function getEmbedDataFromGist(
	inputUrl: URL,
	signal: AbortSignal,
): Promise<EmbedData> {
	let error = false;

	// https://gist.github.com/crutchcorn/36fe5553219c05ea38bacf1c7396085b
	const gistPathParts = inputUrl.pathname.split("/").filter(Boolean);
	const githubUsername = gistPathParts[0];
	const gistId = gistPathParts[1];
	if (!githubUsername || !gistId) {
		console.error(`Invalid gist URL: ${inputUrl}`);
		error = true;
	}

	const data = await github.getGistById({ gistId, signal }).catch((e) => {
		console.error(`Unable to fetch gist data for '${inputUrl}'`, e);
		return undefined;
	});

	if (!data) return { error: true };

	const gistFiles = data.files ?? {};

	const getFileKey = (filename: string) => {
		const filenameHash = crypto
			.createHash("md5")
			.update(filename)
			.digest("hex");
		return `remote-gist/${gistId}/${filenameHash}`;
	};

	for (const [filename, file] of Object.entries(gistFiles)) {
		const key = getFileKey(filename);
		const url = new URL(String(file?.raw_url));

		const request = await fetchAsBot({
			url,
			method: "GET",
			skipRobotsCheck: true,
			signal,
		});

		await s3.upload(BUCKET, key, undefined, request.body, "text/plain");
	}

	let deletedFilesResult: { filename: string }[] = [];

	await db.transaction(async (tx) => {
		const gistData = {
			gistId,
			username: githubUsername,
			description: data.description,
		};

		await tx
			.insert(urlMetadataGist)
			.values(gistData)
			.onConflictDoUpdate({ target: urlMetadataGist.gistId, set: gistData });

		for (const [filename, file] of Object.entries(gistFiles)) {
			const gistFileData = {
				gistId,
				filename,
				contentKey: getFileKey(filename),
				language: file?.language ?? "text",
			};

			await tx
				.insert(urlMetadataGistFile)
				.values(gistFileData)
				.onConflictDoUpdate({
					target: [urlMetadataGistFile.gistId, urlMetadataGistFile.filename],
					set: gistFileData,
				});
		}

		// Delete any files that were removed from the gist
		deletedFilesResult = await tx
			.delete(urlMetadataGistFile)
			.where(
				and(
					eq(urlMetadataGistFile.gistId, gistId),
					not(inArray(urlMetadataGistFile.filename, Object.keys(gistFiles))),
				),
			)
			.returning({
				filename: urlMetadataGistFile.filename,
			});
	});

	// Clean up deleted files from S3
	for (const { filename } of deletedFilesResult) {
		await s3.remove(BUCKET, getFileKey(filename));
	}

	return {
		gistId,
		error,
	};
}
