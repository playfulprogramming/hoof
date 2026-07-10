import { env } from "@playfulprogramming/common";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import {
	db,
	posts,
	postData,
	postAuthors,
	postTags,
	postAttachments,
} from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { s3 } from "@playfulprogramming/s3";
import { createProcessor } from "../../createProcessor.ts";
import { eq } from "drizzle-orm";
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
	postSlug: string;
	attachmentName: string;
	attachmentKey: string;
	sha: string;
	width: number | null;
	height: number | null;
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

			const removedAttachmentRows = await db
				.select({ attachmentKey: postAttachments.attachmentKey })
				.from(postAttachments)
				.where(eq(postAttachments.postSlug, post));

			if (removedAttachmentRows.length > 0) {
				const bucket = await s3.ensureBucket(env.S3_BUCKET);
				await Promise.all(
					removedAttachmentRows.map(async ({ attachmentKey }) => {
						await s3.remove(bucket, attachmentKey);
						console.log(`Removed attachment ${attachmentKey} from S3`);
					}),
				);
			}

			const removedAuthorRows = await db
				.select({ authorSlug: postAuthors.authorSlug })
				.from(postAuthors)
				.where(eq(postAuthors.postSlug, post));

			await db.delete(posts).where(eq(posts.slug, post));

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
	const allAuthorSlugs = new Set<string>([author]);
	const allTags = new Set<string>();

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

			if (parsed.authors) {
				parsed.authors.forEach((a) => allAuthorSlugs.add(a));
			}

			if (parsed.tags) {
				parsed.tags.forEach((t) => allTags.add(t));
			}

			// If the description is missing, populate it from the content
			parsed.description ??= extractMarkdownExcerpt(content, 150);
			// calculate a (very) approximate word count
			const wordCount = content.split(/\s+/).length;

			return { locale, rawMarkdown, parsed, wordCount };
		}),
	);

	const authorSlugs = [...allAuthorSlugs];
	const tags = [...allTags];

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
	const attachmentEntries = collectAttachmentEntries(
		folderResponse.data.entries,
	);

	const previousAttachmentRows = await db
		.select({
			attachmentName: postAttachments.attachmentName,
			attachmentKey: postAttachments.attachmentKey,
			sha: postAttachments.sha,
			width: postAttachments.width,
			height: postAttachments.height,
		})
		.from(postAttachments)
		.where(eq(postAttachments.postSlug, post));
	const previousAttachmentsByName = new Map(
		previousAttachmentRows.map((row) => [row.attachmentName, row]),
	);

	const discoveredAttachmentNames = new Set(
		attachmentEntries.map((entry) => entry.name),
	);

	for (const [attachmentName, row] of previousAttachmentsByName) {
		if (!discoveredAttachmentNames.has(attachmentName)) {
			await s3.remove(bucket, row.attachmentKey);
			console.log(
				`Removed attachment ${row.attachmentKey} from S3 (no longer in repo)`,
			);
		}
	}

	const attachmentRows: AttachmentRow[] = [];

	for (const { name, path, sha } of attachmentEntries) {
		const previous = previousAttachmentsByName.get(name);

		// Content-addressed keys mean an unchanged sha implies an unchanged
		// object in S3 - carry the existing row forward without touching GitHub
		// or S3 at all.
		if (previous !== undefined && previous.sha === sha) {
			attachmentRows.push({
				postSlug: post,
				attachmentName: name,
				attachmentKey: previous.attachmentKey,
				sha,
				width: previous.width,
				height: previous.height,
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

		const isImage = isImageAttachment(name);
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

		// The key is derived from the file's sha, so a changed file always gets
		// a brand-new key - no risk of collision. Upload the new object before
		// removing the old one, so a failed upload doesn't leave the persisted
		// row pointing at a key that no longer exists in S3.
		const extension = isImage ? ".jpeg" : extname(name);
		const attachmentKey = `posts/${post}/attachments/${sha}${extension}`;

		await s3.upload(
			bucket,
			attachmentKey,
			undefined,
			buffer,
			mimeTypeForAttachment(attachmentKey),
		);
		console.log(`Uploaded attachment ${attachmentKey} to S3`);

		if (previous !== undefined) {
			await s3.remove(bucket, previous.attachmentKey);
		}

		attachmentRows.push({
			postSlug: post,
			attachmentName: name,
			attachmentKey,
			sha,
			width,
			height,
		});
	}

	// =========================================================================
	// Phase 4: Perform all database operations in a single transaction
	// =========================================================================
	const previousAuthorRows = await db
		.select({ authorSlug: postAuthors.authorSlug })
		.from(postAuthors)
		.where(eq(postAuthors.postSlug, post));
	const previousAuthorSlugs = previousAuthorRows.map((r) => r.authorSlug);

	await db.transaction(async (tx) => {
		await tx
			.insert(posts)
			.values({
				slug: post,
				collectionSlug: collection,
				collectionOrder: localeData[0]?.parsed?.order,
			})
			.onConflictDoNothing();

		for (const { locale, parsed, wordCount } of localeData) {
			const postDataRecord = {
				slug: post,
				locale,
				title: parsed.title,
				version: parsed.version,
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

		await tx.delete(postTags).where(eq(postTags.postSlug, post));

		if (tags.length > 0) {
			await tx.insert(postTags).values(
				tags.map((tag) => ({
					postSlug: post,
					tag,
				})),
			);
		}

		await tx.delete(postAttachments).where(eq(postAttachments.postSlug, post));

		if (attachmentRows.length > 0) {
			await tx.insert(postAttachments).values(attachmentRows);
		}
	});

	// Re-evaluate achievements for every author touched by this post, including
	// authors removed from the frontmatter so their stats are recomputed too.
	// createJob deduplicates by key, so concurrent post syncs for the same
	// author collapse into a single achievements job.
	const affectedAuthorSlugs = [
		...new Set([...authorSlugs, ...previousAuthorSlugs]),
	];

	for (const authorSlug of affectedAuthorSlugs) {
		await createJob(
			Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
			`grant-author-achievements:${authorSlug}`,
			{ profileSlug: authorSlug },
		);
	}
});
