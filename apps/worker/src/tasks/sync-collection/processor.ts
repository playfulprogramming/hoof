import { env } from "@playfulprogramming/common";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import {
	collectionAuthors,
	collectionData,
	collections,
	collectionTags,
	db,
} from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import { eq } from "drizzle-orm";
import matter from "gray-matter";
import { CollectionMetaSchema } from "./types.ts";
import { Value } from "typebox/value";
import { extractLocale } from "../../utils/extractLocale.ts";
import { uploadProcessedImage } from "../../utils/uploadProcessedImage.ts";

const IMAGE_SIZE_MAX = 2048;

export default createProcessor(
	Tasks.SYNC_COLLECTION,
	async (job, { signal }) => {
		const authorId = job.data.author;
		const collectionId = job.data.collection;

		const collectionMetaUrl = new URL(
			`content/${encodeURIComponent(authorId)}/collections/${encodeURIComponent(collectionId)}/`,
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
			if (collectionMetaResponse.status === 404) {
				console.log(
					`Metadata for ${collectionId} (${collectionMetaUrl.pathname}) returned 404 - removing collection entry.`,
				);
				await db
					.delete(collectionData)
					.where(eq(collectionData.slug, collectionId));
				return;
			}

			throw new Error(`Unable to fetch collection data for ${collectionId}`);
		}

		if (
			!collectionMetaResponse.data.entries ||
			!Array.isArray(collectionMetaResponse.data.entries)
		) {
			throw new Error(`Unable to fetch collection data for ${collectionId}`);
		}

		type Entry = (typeof collectionMetaResponse.data.entries)[number];

		const collectionEntries = collectionMetaResponse.data.entries.reduce(
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

		const allTags = new Set<string>();

		// Accumulate all unique author slugs touched across locale iterations
		// so we can enqueue achievements for each of them after the loop.
		const touchedAuthorSlugs = new Set<string>();

		// Check if coverImg or socialImg have changed since last edit, if so upload to S3
		for (const { entry, locale } of collectionEntries) {
			const contentUrl = new URL(entry.path, "http://localhost");

			const contentResponse = await github.getContentsRaw({
				ref: job.data.ref,
				path: contentUrl.pathname,
				repoOwner: env.GITHUB_REPO_OWNER,
				repoName: env.GITHUB_REPO_NAME,
				signal,
			});

			if (contentResponse.data === undefined) {
				throw new Error(
					`Unable to fetch collection content for ${collectionId} locale ${locale}`,
				);
			}

			const { data } = matter(contentResponse.data);
			const collectionParsedData = Value.Parse(CollectionMetaSchema, data);

			if (collectionParsedData.tags) {
				collectionParsedData.tags.forEach((tag) => allTags.add(tag));
			}

			let coverImgKey: string | null = null;
			let socialImgKey: string | null = null;
			if (collectionParsedData.coverImg) {
				const coverImgUrl = new URL(
					collectionParsedData.coverImg,
					collectionMetaUrl,
				);
				const { data: coverImgStream } = await github.getContentsRawStream({
					ref: job.data.ref,
					path: coverImgUrl.pathname,
					repoOwner: env.GITHUB_REPO_OWNER,
					repoName: env.GITHUB_REPO_NAME,
					signal,
				});

				if (coverImgStream === null || typeof coverImgStream === "undefined") {
					throw new Error(
						`Unable to fetch cover image for ${collectionId} (${coverImgUrl.pathname})`,
					);
				}

				coverImgKey = `collections/${collectionId}/${locale}/cover.jpg`;
				await uploadProcessedImage(
					coverImgStream,
					coverImgKey,
					IMAGE_SIZE_MAX,
					signal,
				);
			}

			if (collectionParsedData.socialImg) {
				const socialImgUrl = new URL(
					collectionParsedData.socialImg,
					collectionMetaUrl,
				);
				const { data: socialImgStream } = await github.getContentsRawStream({
					ref: job.data.ref,
					path: socialImgUrl.pathname,
					repoOwner: env.GITHUB_REPO_OWNER,
					repoName: env.GITHUB_REPO_NAME,
					signal,
				});

				if (
					socialImgStream === null ||
					typeof socialImgStream === "undefined"
				) {
					throw new Error(
						`Unable to fetch social image for ${collectionId} (${socialImgUrl.pathname})`,
					);
				}

				socialImgKey = `collections/${collectionId}/${locale}/social.jpg`;
				await uploadProcessedImage(
					socialImgStream,
					socialImgKey,
					IMAGE_SIZE_MAX,
					signal,
				);
			}

			const result = {
				slug: collectionId,
				locale: locale,
				title: collectionParsedData.title,
				description: collectionParsedData.description,
				coverImage: coverImgKey,
				socialImage: socialImgKey,
				meta: {
					buttons: collectionParsedData.buttons,
					tags: collectionParsedData.tags,
					chapterList: collectionParsedData.chapterList,
				},
			};

			// Handle authors
			const authorSlugs = collectionParsedData.authors
				? [...new Set([...collectionParsedData.authors, authorId])]
				: [authorId];

			authorSlugs.forEach((s) => touchedAuthorSlugs.add(s));

			await db.transaction(async (tx) => {
				await tx
					.insert(collections)
					.values({ slug: collectionId })
					.onConflictDoNothing();

				await tx
					.insert(collectionData)
					.values(result)
					.onConflictDoUpdate({
						target: [collectionData.slug, collectionData.locale],
						set: result,
					});

				// Delete existing author associations for this collection
				await tx
					.delete(collectionAuthors)
					.where(eq(collectionAuthors.collectionSlug, collectionId));

				// Insert new author associations
				if (authorSlugs.length > 0) {
					await tx.insert(collectionAuthors).values(
						authorSlugs.map((authorSlug) => ({
							collectionSlug: collectionId,
							authorSlug,
						})),
					);
				}
			});
		}

		const tags = [...allTags];

		await db.transaction(async (tx) => {
			// Delete existing tag associations for this collection
			await tx
				.delete(collectionTags)
				.where(eq(collectionTags.collectionSlug, collectionId));

			// Insert new tag associations
			if (tags.length > 0) {
				await tx.insert(collectionTags).values(
					tags.map((tag) => ({
						collectionSlug: collectionId,
						tag,
					})),
				);
			}
		});

		for (const authorSlug of touchedAuthorSlugs) {
			await createJob(
				Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
				`grant-author-achievements:${authorSlug}`,
				{ profileSlug: authorSlug },
			);
		}
	},
);
