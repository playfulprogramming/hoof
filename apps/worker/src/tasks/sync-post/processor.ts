import { Tasks, env } from "@playfulprogramming/common";
import {
	db,
	postData,
	postAuthors,
	profiles,
	collectionChapters,
} from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { s3 } from "@playfulprogramming/s3";
import { createProcessor } from "../../createProcessor.ts";
import { eq, inArray, and } from "drizzle-orm";
import matter from "gray-matter";
import { Value } from "@sinclair/typebox/value";
import { PostMetaSchema } from "./types.ts";

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

			// Delete post data (postAuthors cascade-deletes via foreign key)
			await db.delete(postData).where(eq(postData.slug, post));

			// Delete from collection chapters if it was part of a collection
			await db
				.delete(collectionChapters)
				.where(eq(collectionChapters.postSlug, post));

			// Note: S3 files are left orphaned (following sync-collection convention)
			return;
		}
		throw new Error(`Failed to fetch post folder: ${basePath}`);
	}

	// Validate we got a folder listing
	if (
		!folderResponse.data.entries ||
		!Array.isArray(folderResponse.data.entries)
	) {
		throw new Error(`Unable to fetch post data for ${post}`);
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

	// Create/get S3 bucket once before processing files
	const bucket = await s3.createBucket(env.S3_BUCKET);

	// Step 4: Process each locale file
	for (const file of localeFiles) {
		const locale = extractLocale(file.name);

		// 4a) Fetch raw markdown content
		const contentUrl = new URL(file.path, "http://localhost");
		const contentResponse = await github.getContentsRaw({
			ref,
			path: contentUrl.pathname,
			repoOwner: env.GITHUB_REPO_OWNER,
			repoName: env.GITHUB_REPO_NAME,
			signal,
		});

		if (contentResponse.data === undefined) {
			throw new Error(
				`Unable to fetch post content for ${post} locale ${locale}`,
			);
		}

		const rawMarkdown = contentResponse.data;

		// 4b) Parse frontmatter with gray-matter
		// gray-matter splits: { data: {title, published, ...}, content: "# Hello..." }
		const { data: frontmatter } = matter(rawMarkdown);

		// 4c) Validate frontmatter against our schema
		// Throws if required fields missing or wrong types
		const parsed = Value.Parse(PostMetaSchema, frontmatter);

		// 4d) Upload full markdown to S3
		// S3 key format: posts/{slug}/{locale}/content.md
		const s3Key = `posts/${post}/${locale}/content.md`;
		await s3.upload(
			bucket,
			s3Key,
			undefined, // no cache control
			Buffer.from(rawMarkdown),
			"text/markdown",
		);

		console.log(`Uploaded ${s3Key} to S3`);

		// 4e) Save metadata to postData table
		const postDataRecord = {
			slug: post,
			locale,
			title: parsed.title,
			version: parsed.version,
			description: parsed.description,
			socialImage: parsed.socialImg ?? null,
			bannerImage: parsed.bannerImg ?? null,
			originalLink: parsed.originalLink ?? null,
			noindex: parsed.noindex,
			editedAt: parsed.edited ? new Date(parsed.edited) : null,
			publishedAt: new Date(parsed.published),
			meta: {
				tags: parsed.tags,
			},
		};

		await db
			.insert(postData)
			.values(postDataRecord)
			.onConflictDoUpdate({
				target: [postData.slug, postData.locale, postData.version],
				set: postDataRecord,
			});

		console.log(`Saved post metadata for ${post} (${locale})`);

		// 4f) Handle authors (postAuthors table)
		// Combine frontmatter authors with folder owner, deduplicated
		const authorSlugs = parsed.authors
			? [...new Set([...parsed.authors, author])]
			: [author];

		// Verify all authors exist in the database
		const existingAuthors = await db
			.select({ slug: profiles.slug })
			.from(profiles)
			.where(inArray(profiles.slug, authorSlugs));

		const existingSlugs = new Set(existingAuthors.map((a) => a.slug));
		const missingAuthors = authorSlugs.filter(
			(slug) => !existingSlugs.has(slug),
		);

		if (missingAuthors.length > 0) {
			throw new Error(
				`Author profiles not found for post ${post}: ${missingAuthors.join(", ")}`,
			);
		}

		// Delete existing author associations for this post
		await db.delete(postAuthors).where(eq(postAuthors.postSlug, post));

		// Insert new author associations
		if (authorSlugs.length > 0) {
			await db.insert(postAuthors).values(
				authorSlugs.map((authorSlug) => ({
					postSlug: post,
					authorSlug,
				})),
			);
		}

		// 4g) If in collection, update collectionChapters table
		if (collection) {
			// Build the URL for this post (used by frontend for navigation)
			const postUrl = `/${author}/posts/${post}`;

			// Delete existing chapter entry for this post/locale
			await db
				.delete(collectionChapters)
				.where(
					and(
						eq(collectionChapters.postSlug, post),
						eq(collectionChapters.locale, locale),
					),
				);

			// Insert new chapter entry
			await db.insert(collectionChapters).values({
				locale,
				collectionSlug: collection,
				postSlug: post,
				title: parsed.title,
				description: parsed.description,
				url: postUrl,
				order: parsed.order ?? 0,
			});

			console.log(
				`Linked post ${post} to collection ${collection} (${locale})`,
			);
		}
	}
});
