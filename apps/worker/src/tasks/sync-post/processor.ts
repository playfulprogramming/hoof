import { Tasks, env } from "@playfulprogramming/common";
import {
	db,
	posts,
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

			await db.delete(postData).where(eq(postData.slug, post));
			await db
				.delete(collectionChapters)
				.where(eq(collectionChapters.postSlug, post));

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

	const bucket = await s3.ensureBucket(env.S3_BUCKET);

	await db.insert(posts).values({ slug: post }).onConflictDoNothing();

	for (const file of localeFiles) {
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

		const s3Key = `posts/${post}/${locale}/content.md`;
		await s3.upload(
			bucket,
			s3Key,
			undefined,
			Buffer.from(rawMarkdown),
			"text/markdown",
		);

		console.log(`Uploaded ${s3Key} to S3`);

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

		await db
			.insert(postData)
			.values(postDataRecord)
			.onConflictDoUpdate({
				target: [postData.slug, postData.locale, postData.version],
				set: postDataRecord,
			});

		console.log(`Saved post metadata for ${post} (${locale})`);

		const authorSlugs = parsed.authors
			? [...new Set([...parsed.authors, author])]
			: [author];

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

		await db.delete(postAuthors).where(eq(postAuthors.postSlug, post));

		if (authorSlugs.length > 0) {
			await db.insert(postAuthors).values(
				authorSlugs.map((authorSlug) => ({
					postSlug: post,
					authorSlug,
				})),
			);
		}

		if (collection) {
			const postUrl = `/${author}/posts/${post}`;

			await db
				.delete(collectionChapters)
				.where(
					and(
						eq(collectionChapters.postSlug, post),
						eq(collectionChapters.locale, locale),
					),
				);

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
