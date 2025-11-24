import { Tasks, env } from "@playfulprogramming/common";
import { collectionData, db } from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import { eq } from "drizzle-orm";
import matter from "gray-matter";
import { CollectionMetaSchema } from "./types.ts";
import { Value } from "@sinclair/typebox/value";

function extractLocale(name: string) {
	const match = name.match(/\.([a-z]+)\.md$/);
	return match ? match[1] : "en";
}

export default createProcessor(Tasks.SYNC_COLLECTION, async (job, { signal }) => {
	const authorId = job.data.author;
	const collectionId = job.data.collection;

	const collectionMetaUrl = new URL(
		`content/${encodeURIComponent(authorId)}/collections/${encodeURIComponent(collectionId)}`,
		"http://localhost",
	);

	const collectionMetaResponse = await github.getContents({
		ref: job.data.ref,
		path: collectionMetaUrl.pathname,
		repoOwner: env.GITHUB_REPO_OWNER,
		repoName: env.GITHUB_REPO_NAME,
		signal,
	});

	if (collectionMetaResponse.data === undefined) {
		if (collectionMetaResponse.response.status == 404) {
			console.log(
				`Metadata for ${collectionId} (${collectionMetaUrl.pathname}) returned 404 - removing collection entry.`,
			);
			await db.delete(collectionData).where(eq(collectionData.slug, collectionId));
			return;
		}

		throw new Error(`Unable to fetch collection data for ${collectionId}`);
	}

	if (!collectionMetaResponse.data.entries || !Array.isArray(collectionMetaResponse.data.entries)) {
		throw new Error(`Unable to fetch collection data for ${collectionId}`);
	}

	type Entry = typeof collectionMetaResponse.data.entries[number]

	const collectionEntries = collectionMetaResponse.data.entries.reduce(
		(prev,
			// entry.name is `index.md` and path is `content/{authorId}/collections/{collectionId}/index.md`
			// We may have many locales in the future, so we need to check the path as well.
			entry) => {
			if (!(entry.name.startsWith("index") && entry.name.endsWith(".md"))) {
				return prev;
			}

			prev.push({ entry, locale: extractLocale(entry.name) })
			return prev;
		},
		[] as Array<{ entry: Entry, locale: string }>
	)

	// Check if coverImg or socialImg have changed since last edit, if so upload to S3
	for (let { entry, locale } of collectionEntries) {
		const contentUrl = new URL(
			entry.path,
			"http://localhost",
		);

		const contentResponse = await github.getContentsRaw({
			ref: job.data.ref,
			path: contentUrl.pathname,
			repoOwner: env.GITHUB_REPO_OWNER,
			repoName: env.GITHUB_REPO_NAME,
			signal,
		});

		if (contentResponse.data === undefined) {
			throw new Error(`Unable to fetch collection content for ${collectionId} locale ${locale}`);
		}

		const { data } = matter(contentResponse.data);
		const collectionData = Value.Parse(CollectionMetaSchema, data);

	}
});
