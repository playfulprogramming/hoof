import { Tasks, env } from "@playfulprogramming/common";
import { collectionAuthors, collectionData, db, profiles } from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import { and, eq, inArray } from "drizzle-orm";
import matter from "gray-matter";
import { CollectionMetaSchema } from "./types.ts";
import { Value } from "@sinclair/typebox/value";
import sharp from "sharp";
import { Readable } from "node:stream";
import { s3 } from "@playfulprogramming/s3";

function extractLocale(name: string) {
	const match = name.match(/\.([a-z]+)\.md$/);
	return match ? match[1] : "en";
}


const IMAGE_SIZE_MAX = 2048;

async function processImg(
	stream: ReadableStream<Uint8Array>,
	uploadKey: string,
) {
	const pipeline = sharp()
		.resize({
			width: IMAGE_SIZE_MAX,
			height: IMAGE_SIZE_MAX,
			fit: "inside",
		})
		.jpeg({ mozjpeg: true });

	Readable.fromWeb(stream as never).pipe(pipeline);

	const bucket = await s3.createBucket(env.S3_BUCKET);
	await s3.upload(bucket, uploadKey, undefined, pipeline, "image/jpeg");
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
		const collectionParsedData = Value.Parse(CollectionMetaSchema, data);

		let coverImgKey: string | null = null;
		let socialImgKey: string | null = null;
		if (collectionParsedData.coverImg) {
			const coverImgUrl = new URL(collectionParsedData.coverImg, collectionMetaUrl);
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
			await processImg(coverImgStream, coverImgKey);
		}

		if (collectionParsedData.socialImg) {
			const socialImgUrl = new URL(collectionParsedData.socialImg, collectionMetaUrl);
			const { data: socialImgStream } = await github.getContentsRawStream({
				ref: job.data.ref,
				path: socialImgUrl.pathname,
				repoOwner: env.GITHUB_REPO_OWNER,
				repoName: env.GITHUB_REPO_NAME,
				signal,
			});

			if (socialImgStream === null || typeof socialImgStream === "undefined") {
				throw new Error(
					`Unable to fetch social image for ${collectionId} (${socialImgUrl.pathname})`,
				);
			}

			socialImgKey = `collections/${collectionId}/${locale}/social.jpg`;
			await processImg(socialImgStream, socialImgKey);
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
			}
		};

		await db.insert(collectionData)
			.values(result)
			.onConflictDoUpdate({ target: [collectionData.slug, collectionData.locale], set: result });

		// Handle authors
		const authorSlugs = collectionParsedData.authors ? [...new Set([...collectionParsedData.authors, authorId])] : [authorId];

		// Verify all authors exist in the database
		const existingAuthors = await db
			.select({ slug: profiles.slug })
			.from(profiles)
			.where(inArray(profiles.slug, authorSlugs));

		const existingSlugs = new Set(existingAuthors.map((a) => a.slug));
		const missingAuthors = authorSlugs.filter((slug) => !existingSlugs.has(slug));

		if (missingAuthors.length > 0) {
			throw new Error(
				`Author profiles not found for collection ${collectionId}: ${missingAuthors.join(", ")}`,
			);
		}

		// Delete existing author associations for this collection
		await db
			.delete(collectionAuthors)
			.where(eq(collectionAuthors.collectionSlug, collectionId));

		// Insert new author associations
		if (authorSlugs.length > 0) {
			await db.insert(collectionAuthors).values(
				authorSlugs.map((authorSlug) => ({
					collectionSlug: collectionId,
					authorSlug,
				})),
			);
		}
	}
});