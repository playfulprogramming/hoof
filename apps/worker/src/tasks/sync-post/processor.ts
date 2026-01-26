import { Tasks, env } from "@playfulprogramming/common";
import { db, posts, postData, postAuthors } from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { s3 } from "@playfulprogramming/s3";
import { createProcessor } from "../../createProcessor.ts";
import { eq } from "drizzle-orm";
import matter from "gray-matter";
import { Value } from "@sinclair/typebox/value";
import { PostMetaSchema } from "./types.ts";
import { extractLocale } from "../../utils/extractLocale.ts";

export default createProcessor(Tasks.SYNC_POST, async (job, { signal }) => {
	const { author, post, collection, ref } = job.data;

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

	const folderResponse = await github.getContents({
		ref,
		path: basePath,
		repoOwner: env.GITHUB_REPO_OWNER,
		repoName: env.GITHUB_REPO_NAME,
		signal,
	});

	if (folderResponse.data === undefined) {
		if (folderResponse.response.status === 404) {
			console.log(
				`Post ${post} (${basePath}) returned 404 - removing from database.`,
			);

			await db.delete(posts).where(eq(posts.slug, post));

			return;
		}
		throw new Error(`Failed to fetch post folder: ${basePath}`);
	}

	if (
		!folderResponse.data.entries ||
		!Array.isArray(folderResponse.data.entries)
	) {
		throw new Error(`Unable to fetch post data for ${post}`);
	}

	const localeFiles = folderResponse.data.entries.filter(
		(entry) => entry.name.startsWith("index") && entry.name.endsWith(".md"),
	);

	if (localeFiles.length === 0) {
		throw new Error(`No index.md files found in: ${basePath}`);
	}

	console.log(
		`Found ${localeFiles.length} locale(s): ${localeFiles.map((f) => extractLocale(f.name)).join(", ")}`,
	);

	// =========================================================================
	// Phase 1: Collect all data from GitHub
	// =========================================================================
	const allAuthorSlugs = new Set<string>([author]);

	const localeData = await Promise.all(
		localeFiles.map(async (file) => {
			const locale = extractLocale(file.name);

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
			const { data: frontmatter } = matter(rawMarkdown);
			const parsed = Value.Parse(PostMetaSchema, frontmatter);

			if (parsed.authors) {
				parsed.authors.forEach((a) => allAuthorSlugs.add(a));
			}

			return { locale, rawMarkdown, parsed };
		}),
	);

	const authorSlugs = [...allAuthorSlugs];

	// =========================================================================
	// Phase 2: Upload all markdown to S3
	// =========================================================================
	const bucket = await s3.ensureBucket(env.S3_BUCKET);

	await Promise.all(
		localeData.map(async ({ locale, rawMarkdown }) => {
			const s3Key = `posts/${post}/${locale}/content.md`;
			await s3.upload(
				bucket,
				s3Key,
				undefined,
				Buffer.from(rawMarkdown),
				"text/markdown",
			);
			console.log(`Uploaded ${s3Key} to S3`);
		}),
	);

	// =========================================================================
	// Phase 3: Perform all database operations in a single transaction
	// =========================================================================
	await db.transaction(async (tx) => {
		await tx
			.insert(posts)
			.values({
				slug: post,
				collectionSlug: collection,
				collectionOrder: localeData[0]?.parsed?.order,
			})
			.onConflictDoNothing();

		for (const { locale, parsed } of localeData) {
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
					tags: parsed.tags ?? [],
					...(parsed.license && { license: parsed.license }),
					...(parsed.upToDateSlug && { upToDateSlug: parsed.upToDateSlug }),
				},
			};

			await tx
				.insert(postData)
				.values(postDataRecord)
				.onConflictDoUpdate({
					target: [postData.slug, postData.locale, postData.version],
					set: postDataRecord,
				});

			console.log(`Saved post metadata for ${post} (${locale})`);
		}

		await tx.delete(postAuthors).where(eq(postAuthors.postSlug, post));

		await tx.insert(postAuthors).values(
			authorSlugs.map((authorSlug) => ({
				postSlug: post,
				authorSlug,
			})),
		);
	});
});
