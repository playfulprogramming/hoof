import { Tasks, env } from "@playfulprogramming/common";
import { db, postData } from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import { eq } from "drizzle-orm";

/**
 * Extracts locale from filename.
 * "index.md" → "en"
 * "index.es.md" → "es"
 */
function extractLocale(filename: string): string {
	const match = filename.match(/index\.([a-z]{2})\.md$/);
	return match ? match[1] : "en";
}

export default createProcessor(Tasks.SYNC_POST, async (job, { signal }) => {
	const { author, post, collection, ref } = job.data;

	// Build path based on whether post is standalone or in a collection
	// Using URL constructor to safely encode special characters in path segments
	const basePath = collection
		? new URL(
				`content/${encodeURIComponent(author)}/collections/${encodeURIComponent(collection)}/posts/${encodeURIComponent(post)}/`,
				"http://localhost",
			).pathname
		: new URL(
				`content/${encodeURIComponent(author)}/posts/${encodeURIComponent(post)}/`,
				"http://localhost",
			).pathname;

	console.log(`Syncing post: ${basePath}`);

	// Step 1: Fetch post folder from GitHub
	// This returns a list of files in the folder (like `ls` command)
	const folderResponse = await github.getContents({
		ref,
		path: basePath,
		repoOwner: env.GITHUB_REPO_OWNER,
		repoName: env.GITHUB_REPO_NAME,
		signal,
	});

	// Step 2: Handle 404 (post was deleted from GitHub)
	if (folderResponse.data === undefined) {
		if (folderResponse.response.status === 404) {
			console.log(
				`Post ${post} (${basePath}) returned 404 - removing from database.`,
			);
			await db.delete(postData).where(eq(postData.slug, post));
			return;
		}
		throw new Error(`Failed to fetch post folder: ${basePath}`);
	}

	// Validate we got a folder listing
	if (
		!folderResponse.data.entries ||
		!Array.isArray(folderResponse.data.entries)
	) {
		throw new Error(`Expected folder but got file at: ${basePath}`);
	}

	// Step 3: Find all locale files (index.md, index.es.md, etc.)
	const localeFiles = folderResponse.data.entries.filter(
		(entry) => entry.name.startsWith("index") && entry.name.endsWith(".md"),
	);

	if (localeFiles.length === 0) {
		throw new Error(`No index.md files found in: ${basePath}`);
	}

	console.log(
		`Found ${localeFiles.length} locale(s): ${localeFiles.map((f) => extractLocale(f.name)).join(", ")}`,
	);

	// TODO Step 4: For each locale file:
	//   a) Fetch raw markdown content
	//   b) Parse frontmatter with gray-matter
	//   c) Validate with PostMetaSchema
	//   d) Upload full markdown to S3
	//   e) Save metadata to postData table
	//   f) Handle authors (postAuthors table)
	//   g) If in collection, update collectionChapters table
});
