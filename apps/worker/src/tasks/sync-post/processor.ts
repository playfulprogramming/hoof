import { env } from "@playfulprogramming/common";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import {
	db,
	posts,
	postAuthors,
	postTags,
	postAttachments,
	postGroups,
	attachments,
} from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { s3 } from "@playfulprogramming/s3";
import { createProcessor } from "../../createProcessor.ts";
import { and, eq, isNotNull } from "drizzle-orm";
import matter from "gray-matter";
import { Value } from "typebox/value";
import sharp from "sharp";
import { Readable } from "node:stream";
import { extname } from "node:path/posix";
import { Response } from "undici";
import { PostMetaSchema } from "./types.ts";
import { extractLocale } from "../../utils/extractLocale.ts";
import { extractMarkdownExcerpt } from "../../utils/extractMarkdownExcerpt.ts";

const ATTACHMENT_IMAGE_SIZE_MAX = 2048;

const IMAGE_EXTENSIONS = new Set([
	".jpg",
	".jpeg",
	".png",
	".gif",
	".webp",
	".avif",
	".bmp",
	".tiff",
]);

const MIME_TYPES: Record<string, string> = {
	".pdf": "application/pdf",
	".ppt": "application/vnd.ms-powerpoint",
	".pptx":
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	".doc": "application/msword",
	".docx":
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xls": "application/vnd.ms-excel",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".zip": "application/zip",
	".txt": "text/plain",
	".csv": "text/csv",
	".mp4": "video/mp4",
	".webm": "video/webm",
	".svg": "image/svg+xml",
	".jpeg": "image/jpeg",
};

function isImageAttachment(relativePath: string): boolean {
	return IMAGE_EXTENSIONS.has(extname(relativePath).toLowerCase());
}

function mimeTypeForAttachment(relativePath: string): string {
	return (
		MIME_TYPES[extname(relativePath).toLowerCase()] ??
		"application/octet-stream"
	);
}

async function resizeAttachmentImage(stream: ReadableStream<Uint8Array>) {
	const pipeline = sharp()
		.resize({
			width: ATTACHMENT_IMAGE_SIZE_MAX,
			height: ATTACHMENT_IMAGE_SIZE_MAX,
			fit: "inside",
			withoutEnlargement: true,
		})
		.jpeg({ mozjpeg: true });

	Readable.fromWeb(stream as never).pipe(pipeline);

	const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

	return { buffer: data, width: info.width, height: info.height };
}

interface AttachmentSourceEntry {
	name: string;
	path: string;
	sha: string;
}

function collectAttachmentEntries(
	entries: Array<{ name: string; path: string; type?: string; sha: string }>,
): AttachmentSourceEntry[] {
	return entries
		.filter((entry) => entry.type !== "dir")
		.filter(
			(entry) =>
				!(entry.name.startsWith("index") && entry.name.endsWith(".md")),
		)
		.map((entry) => ({ name: entry.name, path: entry.path, sha: entry.sha }));
}

interface AttachmentRow {
	attachmentKey: string;
	attachmentName: string;
}

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
		if (folderResponse.status === 404) {
			console.log(
				`Post ${post} (${basePath}) returned 404 - removing from database.`,
			);

			const removedAuthorRows = await db.transaction(async (tx) => {
				const removalFilter = and(eq(posts.slug, post), eq(posts.branch, ref));

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
					{ profileSlug: authorSlug },
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
	// Phase 3: Discover, resize, diff, and upload post attachments
	// =========================================================================
	const attachmentRows: AttachmentRow[] = [];
	const existingAttachmentRecords = await db
		.select({ attachmentKey: attachments.attachmentKey })
		.from(attachments)
		.innerJoin(
			postAttachments,
			eq(postAttachments.attachmentKey, attachments.attachmentKey),
		)
		.innerJoin(posts, eq(posts.id, postAttachments.postId))
		.where(eq(posts.slug, post));
	const existingAttachmentKeys = new Set(
		existingAttachmentRecords.map(({ attachmentKey }) => attachmentKey),
	);

	for (const { name, path, sha } of collectAttachmentEntries(
		folderResponse.data.entries,
	)) {
		const isImage = isImageAttachment(name);

		// The key is derived from the file's sha, so a changed file always gets
		// a brand-new key - no risk of collision. Upload the new object before
		// removing the old one, so a failed upload doesn't leave the persisted
		// row pointing at a key that no longer exists in S3.
		const extension = isImage ? ".jpeg" : extname(name);
		const attachmentKey = `posts/${post}/attachments/${sha}${extension}`;

		// Content-addressed keys mean an unchanged sha implies an unchanged
		// object in S3 - carry the existing row forward without touching GitHub
		// or S3 at all.
		if (existingAttachmentKeys.has(attachmentKey)) {
			attachmentRows.push({
				attachmentKey,
				attachmentName: name,
			});
			continue;
		}

		const { data: fileStream } = await github.getContentsRawStream({
			ref,
			path,
			repoOwner: env.GITHUB_REPO_OWNER,
			repoName: env.GITHUB_REPO_NAME,
			signal,
		});

		if (fileStream === undefined) {
			throw new Error(`Unable to fetch attachment ${name} for ${post}`);
		}

		let buffer: Buffer;
		let width: number | null = null;
		let height: number | null = null;

		if (isImage) {
			const resized = await resizeAttachmentImage(fileStream);
			buffer = resized.buffer;
			width = resized.width;
			height = resized.height;
		} else {
			buffer = Buffer.from(await new Response(fileStream).arrayBuffer());
		}

		await s3.upload(
			bucket,
			attachmentKey,
			undefined,
			buffer,
			mimeTypeForAttachment(attachmentKey),
		);
		console.log(`Uploaded attachment ${attachmentKey} to S3`);

		await db.insert(attachments).values({
			attachmentKey,
			sha,
			width,
			height,
		});

		attachmentRows.push({
			attachmentKey,
			attachmentName: name,
		});
	}

	// =========================================================================
	// Phase 4: Perform all database operations in a single transaction
	// =========================================================================
	const previousAuthorRows = await db
		.select({ authorSlug: postAuthors.authorSlug })
		.from(posts)
		.innerJoin(postAuthors, eq(posts.id, postAuthors.postId))
		.where(and(eq(posts.slug, post), eq(posts.branch, ref)));
	const affectedAuthorSlugs = new Set(
		previousAuthorRows.map((r) => r.authorSlug),
	);

	await db.transaction(async (tx) => {
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

			// Remove the existing post record (relations are removed by cascading deletes)
			await db
				.delete(posts)
				.where(
					and(
						eq(posts.slug, post),
						eq(posts.locale, locale),
						eq(posts.branch, ref),
					),
				);

			const postValues = {
				slug: post,
				locale,
				branch: ref,
				groupId,
				collectionSlug: collection,
				collectionOrder: localeData[0]?.parsed?.order,
				versionName: parsed.version,
				title: parsed.title,
				description: parsed.description,
				wordCount,
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

			const [postRecord] = await tx
				.insert(posts)
				.values(postValues)
				.returning({ id: posts.id });

			const authorSlugs = new Set<string>([author, ...(parsed.authors ?? [])]);
			parsed.authors?.forEach((authorSlug) =>
				affectedAuthorSlugs.add(authorSlug),
			);

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
			{ profileSlug: authorSlug },
		);
	}
});
