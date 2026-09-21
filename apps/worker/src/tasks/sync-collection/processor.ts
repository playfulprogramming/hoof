import { env, CollectionMetaSchema } from "@playfulprogramming/common";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import {
	collectionAttachments,
	collectionAuthors,
	collections,
	collectionSlugs,
	collectionTags,
	db,
} from "@playfulprogramming/db";
import { createInstallationClient } from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import { and, eq } from "drizzle-orm";
import matter from "gray-matter";
import { Value } from "typebox/value";
import { extractLocale } from "../../utils/extractLocale.ts";
import { resolveAttachment, syncAttachments } from "../../sync/attachments.ts";

export default createProcessor(
	Tasks.SYNC_COLLECTION,
	async (job, { signal }) => {
		const authorSlug = job.data.author;
		const collectionSlug = job.data.collection;
		const client = await createInstallationClient(job.data.installation.id);

		const collectionMetaUrl = new URL(
			`content/${encodeURIComponent(authorSlug)}/collections/${encodeURIComponent(collectionSlug)}/`,
			"http://localhost",
		);

		const folderResponse = await client.getContents({
			ref: job.data.ref,
			path: collectionMetaUrl.pathname,
			repoOwner: env.GITHUB_REPO_OWNER,
			repoName: env.GITHUB_REPO_NAME,
			signal,
		});

		if (folderResponse.data === undefined) {
			if (folderResponse.status === 404) {
				console.log(
					`Metadata for ${collectionSlug} (${collectionMetaUrl.pathname}) returned 404 - removing collection entry.`,
				);
				await db
					.delete(collections)
					.where(
						and(
							eq(collections.slug, collectionSlug),
							eq(collections.branch, job.data.branch),
						),
					);
				return;
			}

			throw new Error(`Unable to fetch collection data for ${collectionSlug}`);
		}

		if (
			!folderResponse.data.entries ||
			!Array.isArray(folderResponse.data.entries)
		) {
			throw new Error(`Unable to fetch collection data for ${collectionSlug}`);
		}

		type Entry = (typeof folderResponse.data.entries)[number];

		const collectionEntries = folderResponse.data.entries.reduce(
			(
				prev,
				// entry.name is `index.md` and path is `content/{authorId}/collections/{collectionId}/index.md`
				// We may have many locales in the future, so we need to check the path as well.
				entry,
			) => {
				if (!(entry.name.startsWith("index") && entry.name.endsWith(".md"))) {
					return prev;
				}

				prev.push({ entry, locale: extractLocale(entry.name) });
				return prev;
			},
			[] as Array<{ entry: Entry; locale: string }>,
		);

		// =========================================================================
		// Phase 1: Collect all data from GitHub
		// =========================================================================
		const allTags = new Set<string>();

		// Accumulate all unique author slugs touched across locale iterations
		// so we can enqueue achievements for each of them after the loop.
		const touchedAuthorSlugs = new Set<string>();

		const localeData = await Promise.all(
			collectionEntries.map(async ({ entry, locale }) => {
				const contentUrl = new URL(entry.path, "http://localhost");

				const contentResponse = await client.getContentsRaw({
					ref: job.data.ref,
					path: contentUrl.pathname,
					repoOwner: env.GITHUB_REPO_OWNER,
					repoName: env.GITHUB_REPO_NAME,
					signal,
				});

				if (contentResponse.data === undefined) {
					throw new Error(
						`Unable to fetch collection content for ${collectionSlug} locale ${locale}`,
					);
				}

				const { data } = matter(contentResponse.data);
				const collectionParsedData = Value.Parse(CollectionMetaSchema, data);

				if (collectionParsedData.tags) {
					collectionParsedData.tags.forEach((tag) => allTags.add(tag));
				}

				return {
					locale,
					parsed: collectionParsedData,
				};
			}),
		);

		// =========================================================================
		// Phase 2: Discover, resize, diff, and upload post attachments
		// =========================================================================
		const attachmentRows = await syncAttachments({
			client,
			ref: job.data.ref,
			folder: folderResponse.data,
			keyPrefix: `collections/${collectionSlug}`,
			signal,
		});

		// =========================================================================
		// Phase 3: Perform all database operations in a single transaction
		// =========================================================================
		await db.transaction(async (tx) => {
			// Remove the existing collection records (relations are removed by cascading deletes)
			await tx
				.delete(collections)
				.where(
					and(
						eq(collections.slug, collectionSlug),
						eq(collections.branch, job.data.branch),
					),
				);

			// Create a slug record (if it doesn't already exist)
			await tx
				.insert(collectionSlugs)
				.values({ slug: collectionSlug })
				.onConflictDoNothing();

			for (const { locale, parsed } of localeData) {
				const coverImage =
					parsed.coverImg &&
					resolveAttachment(parsed.coverImg, attachmentRows)?.attachmentKey;
				const socialImage =
					parsed.socialImg &&
					resolveAttachment(parsed.socialImg, attachmentRows)?.attachmentKey;

				const result = {
					slug: collectionSlug,
					locale: locale,
					branch: job.data.branch,
					title: parsed.title,
					description: parsed.description,
					coverImage: coverImage ?? null,
					socialImage: socialImage ?? null,
					meta: {
						buttons: parsed.buttons,
						tags: parsed.tags,
						chapterList: parsed.chapterList,
					},
				};

				// Handle authors
				const authorSlugs = parsed.authors
					? [...new Set([...parsed.authors, authorSlug])]
					: [authorSlug];

				authorSlugs.forEach((s) => touchedAuthorSlugs.add(s));

				const [collectionRecord] = await tx
					.insert(collections)
					.values(result)
					.returning({ id: collections.id });

				if (!collectionRecord) throw new Error("undefined collectionRecord");

				// Delete existing author associations for this collection
				await tx
					.delete(collectionAuthors)
					.where(eq(collectionAuthors.collectionId, collectionRecord.id));

				// Insert new author associations
				if (authorSlugs.length > 0) {
					await tx.insert(collectionAuthors).values(
						authorSlugs.map((authorSlug) => ({
							collectionId: collectionRecord.id,
							authorSlug,
						})),
					);
				}

				// Delete existing tag associations for this collection
				await tx
					.delete(collectionTags)
					.where(eq(collectionTags.collectionId, collectionRecord.id));

				// Insert new tag associations
				if (allTags.size > 0) {
					await tx.insert(collectionTags).values(
						[...allTags].map((tag) => ({
							collectionId: collectionRecord.id,
							tag,
						})),
					);
				}

				if (attachmentRows.length > 0) {
					await tx.insert(collectionAttachments).values(
						Array.from(
							attachmentRows.values().map((row) => ({
								collectionId: collectionRecord.id,
								attachmentKey: row.attachmentKey,
								attachmentName: row.attachmentName,
							})),
						),
					);
				}
			}
		});

		for (const authorSlug of touchedAuthorSlugs) {
			await createJob(
				Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
				`grant-author-achievements:${authorSlug}`,
				{ authorSlug, installation: job.data.installation },
			);
		}
	},
);
