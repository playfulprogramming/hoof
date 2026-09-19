import { env, PostMetaSchema } from "@playfulprogramming/common";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import {
	db,
	posts,
	postAuthors,
	postTags,
	postAttachments,
	postGroups,
} from "@playfulprogramming/db";
import { createInstallationClient } from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import { and, eq, isNotNull } from "drizzle-orm";
import matter from "gray-matter";
import { Value } from "typebox/value";
import { extractLocale } from "../../utils/extractLocale.ts";
import { extractMarkdownExcerpt } from "../../utils/extractMarkdownExcerpt.ts";
import { resolveAttachment, syncAttachments } from "../../sync/attachments.ts";

export default createProcessor(Tasks.SYNC_POST, async (job, { signal }) => {
	const { author, post, collection, ref, branch, installation } = job.data;
	const client = await createInstallationClient(installation.id);

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

	const folderResponse = await client.getContents({
		ref,
		path: basePath,
		repoOwner: env.GITHUB_REPO_OWNER,
		repoName: env.GITHUB_REPO_NAME,
		signal,
	});

	if (folderResponse.data === undefined) {
		if (folderResponse.status === 404) {
			console.log(
				`Post ${post} (${basePath}) returned 404 - removing from database.`,
			);

			const removedAuthorRows = await db.transaction(async (tx) => {
				const removalFilter = and(
					eq(posts.slug, post),
					eq(posts.branch, branch),
				);

				const removedAuthorRows = await tx
					.select({ authorSlug: postAuthors.authorSlug })
					.from(postAuthors)
					.innerJoin(posts, eq(posts.id, postAuthors.postId))
					.where(removalFilter);

				await tx.delete(posts).where(removalFilter);
				return removedAuthorRows;
			});

			for (const { authorSlug } of removedAuthorRows) {
				await createJob(
					Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
					`grant-author-achievements:${authorSlug}`,
					{ authorSlug, installation: job.data.installation },
				);
			}

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
	const localeData = await Promise.all(
		localeFiles.map(async (file) => {
			const locale = extractLocale(file.name);

			const contentUrl = new URL(file.path, "http://localhost");
			const contentResponse = await client.getContentsRaw({
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
			const { data: frontmatter, content } = matter(rawMarkdown);
			const parsed = Value.Parse(PostMetaSchema, frontmatter);

			// If the description is missing, populate it from the content
			parsed.description ??= extractMarkdownExcerpt(content, 150);
			// calculate a (very) approximate word count
			const wordCount = content.split(/\s+/).length;

			return { locale, rawMarkdown, parsed, wordCount };
		}),
	);

	// =========================================================================
	// Phase 2: Discover, resize, diff, and upload post attachments
	// =========================================================================
	const attachmentRows = await syncAttachments({
		client,
		ref,
		folder: folderResponse.data,
		keyPrefix: `posts/${post}`,
		signal,
	});

	// =========================================================================
	// Phase 3: Perform all database operations in a single transaction
	// =========================================================================
	const previousAuthorRows = await db
		.select({ authorSlug: postAuthors.authorSlug })
		.from(posts)
		.innerJoin(postAuthors, eq(posts.id, postAuthors.postId))
		.where(and(eq(posts.slug, post), eq(posts.branch, branch)));
	const affectedAuthorSlugs = new Set(
		previousAuthorRows.map((r) => r.authorSlug),
	);

	await db.transaction(async (tx) => {
		// Remove the existing post records (relations are removed by cascading deletes)
		await tx
			.delete(posts)
			.where(and(eq(posts.slug, post), eq(posts.branch, branch)));

		for (const { locale, parsed, wordCount } of localeData) {
			let groupId: string | undefined;
			if (parsed.upToDateSlug) {
				const upToDatePosts = await tx
					.select({ groupId: posts.groupId })
					.from(posts)
					.where(
						and(eq(posts.slug, parsed.upToDateSlug), isNotNull(posts.groupId)),
					)
					.limit(1);

				groupId = upToDatePosts[0]?.groupId || undefined;

				if (!groupId) {
					const [newGroup] = await tx
						.insert(postGroups)
						.values({})
						.returning({ id: postGroups.id });
					groupId = newGroup.id;
				}
			}

			const socialImage =
				parsed.socialImg &&
				resolveAttachment(parsed.socialImg, attachmentRows)?.attachmentKey;
			const bannerImage =
				parsed.bannerImg &&
				resolveAttachment(parsed.bannerImg, attachmentRows)?.attachmentKey;

			const postValues = {
				slug: post,
				locale,
				branch,
				groupId,
				collectionSlug: collection,
				collectionOrder: localeData[0]?.parsed?.order,
				versionName: parsed.version,
				title: parsed.title,
				description: parsed.description,
				wordCount,
				socialImage: socialImage ?? null,
				bannerImage: bannerImage ?? null,
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

			const [postRecord] = await tx
				.insert(posts)
				.values(postValues)
				.returning({ id: posts.id });

			const authorSlugs = new Set<string>([author, ...(parsed.authors ?? [])]);
			authorSlugs.forEach((authorSlug) => affectedAuthorSlugs.add(authorSlug));

			await tx.insert(postAuthors).values(
				Array.from(
					authorSlugs.values().map((authorSlug) => ({
						postId: postRecord.id,
						authorSlug,
					})),
				),
			);

			if (parsed.tags && parsed.tags.length > 0) {
				await tx.insert(postTags).values(
					parsed.tags.map((tag) => ({
						postId: postRecord.id,
						tag,
					})),
				);
			}

			if (attachmentRows.length > 0) {
				await tx.insert(postAttachments).values(
					Array.from(
						attachmentRows.values().map((row) => ({
							postId: postRecord.id,
							attachmentKey: row.attachmentKey,
							attachmentName: row.attachmentName,
						})),
					),
				);
			}

			console.log(`Saved post metadata for ${post} (${locale})`);
		}
	});

	// Re-evaluate achievements for every author touched by this post, including
	// authors removed from the frontmatter so their stats are recomputed too.
	// createJob deduplicates by key, so concurrent post syncs for the same
	// author collapse into a single achievements job.
	for (const authorSlug of affectedAuthorSlugs) {
		await createJob(
			Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
			`grant-author-achievements:${authorSlug}`,
			{ authorSlug, installation: job.data.installation },
		);
	}
});
