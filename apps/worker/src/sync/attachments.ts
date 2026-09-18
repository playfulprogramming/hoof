import { env } from "@playfulprogramming/common";
import { attachments, db } from "@playfulprogramming/db";
import type { GitHubClient } from "@playfulprogramming/github-api";
import { s3 } from "@playfulprogramming/s3";
import { inArray } from "drizzle-orm";
import { extname } from "path";
import sharp from "sharp";
import { Readable } from "stream";

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
	".md": "text/plain",
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
	attachmentKey: string;
	attachmentName: string;
	isImage: boolean;
	path: string;
	sha: string;
}

type DirEntry = { name: string; path: string; type?: string; sha: string };

function collectAttachmentEntries(
	keyPrefix: string,
	entries: Array<DirEntry>,
): AttachmentSourceEntry[] {
	return entries
		.filter((entry) => entry.type !== "dir")
		.map((entry) => {
			const isImage = isImageAttachment(entry.name);

			// The key is derived from the file's sha, so a changed file always gets
			// a brand-new key - no risk of collision. Upload the new object before
			// removing the old one, so a failed upload doesn't leave the persisted
			// row pointing at a key that no longer exists in S3.
			const extension = isImage ? ".jpeg" : extname(entry.name);
			const attachmentKey = `${keyPrefix}/attachments/${entry.sha}${extension}`;
			return {
				attachmentKey,
				attachmentName: entry.name,
				isImage,
				path: entry.path,
				sha: entry.sha,
			};
		});
}

interface AttachmentRow {
	attachmentKey: string;
	attachmentName: string;
}

interface SyncAttachmentParams {
	client: GitHubClient;
	ref: string;
	folder: { entries: Array<DirEntry> };
	keyPrefix: string;
	signal: AbortSignal;
}

export async function syncAttachments({
	client,
	ref,
	folder,
	keyPrefix,
	signal,
}: SyncAttachmentParams): Promise<AttachmentRow[]> {
	const attachmentEntries = collectAttachmentEntries(keyPrefix, folder.entries);
	const attachmentRows: AttachmentRow[] = [];
	const bucket = await s3.ensureBucket(env.S3_BUCKET);

	const existingAttachmentRecords = await db
		.select({ attachmentKey: attachments.attachmentKey })
		.from(attachments)
		.where(
			inArray(
				attachments.attachmentKey,
				attachmentEntries.map((e) => e.attachmentKey),
			),
		);
	const existingAttachmentKeys = new Set(
		existingAttachmentRecords.map((r) => r.attachmentKey),
	);

	for (const {
		attachmentKey,
		isImage,
		attachmentName,
		path,
		sha,
	} of attachmentEntries) {
		// Content-addressed keys mean an unchanged sha implies an unchanged
		// object in S3 - carry the existing row forward without touching GitHub
		// or S3 at all.
		if (existingAttachmentKeys.has(attachmentKey)) {
			attachmentRows.push({
				attachmentKey,
				attachmentName,
			});
			continue;
		}

		const { data: fileStream } = await client.getContentsRawStream({
			ref,
			path,
			repoOwner: env.GITHUB_REPO_OWNER,
			repoName: env.GITHUB_REPO_NAME,
			signal,
		});

		if (fileStream === undefined) {
			throw new Error(`Unable to fetch attachment ${name} for ${keyPrefix}`);
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

		// onConflictDoUpdate (not DoNothing) so a conflicting insert - e.g. the
		// same sha reused across posts/branches - still refreshes lastModified.
		// Otherwise a stale timestamp could let the cleanup sweep delete this row
		// in the narrow window before its new post_attachments reference commits.
		const attachmentLastModified = new Date();
		await db
			.insert(attachments)
			.values({
				attachmentKey,
				sha,
				width,
				height,
				lastModified: attachmentLastModified,
			})
			.onConflictDoUpdate({
				target: attachments.attachmentKey,
				set: { lastModified: attachmentLastModified },
			});

		attachmentRows.push({
			attachmentKey,
			attachmentName,
		});
	}

	return attachmentRows;
}

export const syncAttachmentsFake: typeof syncAttachments = async (p) => {
	return collectAttachmentEntries(p.keyPrefix, p.folder.entries).map((e) => ({
		attachmentKey: e.attachmentKey,
		attachmentName: e.attachmentName,
	}));
};

export function resolveAttachment(path: string, rows: AttachmentRow[]) {
	const attachmentName = new URL(path, "http://localhost").pathname.slice(1);
	return rows.find((row) => row.attachmentName === attachmentName);
}
