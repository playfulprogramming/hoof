import { env, CollectionMetaSchema } from "@playfulprogramming/common";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import {
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
import { uploadProcessedImage } from "../../utils/uploadProcessedImage.ts";

const IMAGE_SIZE_MAX = 2048;

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

		const collectionMetaResponse = await client.getContents({
			ref: job.data.ref,
			path: collectionMetaUrl.pathname,
			repoOwner: env.GITHUB_REPO_OWNER,
			repoName: env.GITHUB_REPO_NAME,
			signal,
		});

		if (collectionMetaResponse.data === undefined) {
			if (collectionMetaResponse.status === 404) {
				console.log(
					`Metadata for ${collectionSlug} (${collectionMetaUrl.pathname}) returned 404 - removing collection entry.`,
				);
				await db
					.delete(collections)
					.where(
						and(
							eq(collections.slug, collectionSlug),
							eq(collections.branch, job.data.ref),
						),
					);
				return;
			}

			throw new Error(`Unable to fetch collection data for ${collectionSlug}`);
		}

		if (
			!collectionMetaResponse.data.entries ||
			!Array.isArray(collectionMetaResponse.data.entries)
		) {
			throw new Error(`Unable to fetch collection data for ${collectionSlug}`);
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

				// Check if coverImg or socialImg have changed since last edit, if so upload to S3
				let coverImgKey: string | null = null;
				let socialImgKey: string | null = null;
				if (collectionParsedData.coverImg) {
					const coverImgUrl = new URL(
						collectionParsedData.coverImg,
						collectionMetaUrl,
					);
					const { data: coverImgStream } = await client.getContentsRawStream({
						ref: job.data.ref,
						path: coverImgUrl.pathname,
						repoOwner: env.GITHUB_REPO_OWNER,
						repoName: env.GITHUB_REPO_NAME,
						signal,
					});

					if (
						coverImgStream === null ||
						typeof coverImgStream === "undefined"
					) {
						throw new Error(
							`Unable to fetch cover image for ${collectionSlug} (${coverImgUrl.pathname})`,
						);
					}

					coverImgKey = `collections/${collectionSlug}/${locale}/cover.jpg`;
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
					const { data: socialImgStream } = await client.getContentsRawStream({
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
							`Unable to fetch social image for ${collectionSlug} (${socialImgUrl.pathname})`,
						);
					}

					socialImgKey = `collections/${collectionSlug}/${locale}/social.jpg`;
					await uploadProcessedImage(
						socialImgStream,
						socialImgKey,
						IMAGE_SIZE_MAX,
						signal,
					);
				}

				return {
					locale,
					parsed: collectionParsedData,
					coverImgKey,
					socialImgKey,
				};
			}),
		);

		await db.transaction(async (tx) => {
			// Remove the existing collection records (relations are removed by cascading deletes)
			await tx
				.delete(collections)
				.where(
					and(
						eq(collections.slug, collectionSlug),
						eq(collections.branch, job.data.ref),
					),
				);

			// Create a slug record (if it doesn't already exist)
			await tx
				.insert(collectionSlugs)
				.values({ slug: collectionSlug })
				.onConflictDoNothing();

			for (const { locale, parsed, ...data } of localeData) {
				const result = {
					slug: collectionSlug,
					locale: locale,
					branch: job.data.ref,
					title: parsed.title,
					description: parsed.description,
					coverImage: data.coverImgKey,
					socialImage: data.socialImgKey,
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
