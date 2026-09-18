import { attachments, db } from "@playfulprogramming/db";
import { createInstallationClient } from "@playfulprogramming/github-api";
import { Readable } from "stream";
import { syncAttachments } from "./attachments.ts";
import { s3 } from "@playfulprogramming/s3";

const ONE_PIXEL_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg==";

const selectExistingAttachments = db
	.select(expect.anything())
	.from(attachments).where;
const insertAttachmentsValues = db.insert(attachments).values;
const insertAttachmentOnConflictDoUpdate = db
	.insert(attachments)
	.values(expect.anything()).onConflictDoUpdate;

const github = await createInstallationClient(0);

test("Uploads post attachments, resizing images and content-addressing their keys by sha", async () => {
	vi.mocked(selectExistingAttachments).mockResolvedValue([]);

	const baseFolderPath = "content/example-author/posts/attachment-post/";

	vi.mocked(github.getContentsRawStream).mockImplementation((params) => {
		if (params.path === `${baseFolderPath}index.md`) {
			return Promise.resolve({
				data: Readable.toWeb(
					Readable.from(Buffer.from("Hello world")),
				) as never,
				status: 200,
			});
		}
		if (params.path === `${baseFolderPath}notes.pdf`) {
			return Promise.resolve({
				data: Readable.toWeb(Readable.from(Buffer.from("PDF-DATA"))) as never,
				status: 200,
			});
		}
		if (params.path === `${baseFolderPath}banner.png`) {
			return Promise.resolve({
				data: Readable.toWeb(
					Readable.from(Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")),
				) as never,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	const folder = {
		entries: [
			{
				name: "index.md",
				path: `${baseFolderPath}index.md`,
				type: "file",
				sha: "index-sha",
			},
			{
				name: "notes.pdf",
				path: `${baseFolderPath}notes.pdf`,
				type: "file",
				sha: "notes-sha",
			},
			{
				name: "banner.png",
				path: `${baseFolderPath}banner.png`,
				type: "file",
				sha: "banner-sha",
			},
		],
	};

	const attachmentRecords = await syncAttachments({
		client: github,
		ref: "main",
		folder,
		keyPrefix: "posts/attachment-post",
		signal: new AbortController().signal,
	});

	expect(attachmentRecords).toEqual([
		{
			attachmentKey: "posts/attachment-post/attachments/index-sha.md",
			attachmentName: "index.md",
		},
		{
			attachmentKey: "posts/attachment-post/attachments/notes-sha.pdf",
			attachmentName: "notes.pdf",
		},
		{
			attachmentKey: "posts/attachment-post/attachments/banner-sha.jpeg",
			attachmentName: "banner.png",
		},
	]);

	// Assert: Non-image attachment uploaded as-is, keyed by its sha and original extension
	expect(s3.upload).toHaveBeenCalledWith(
		"example-bucket",
		"posts/attachment-post/attachments/index-sha.md",
		undefined,
		expect.anything(),
		"text/plain",
	);

	expect(s3.upload).toHaveBeenCalledWith(
		"example-bucket",
		"posts/attachment-post/attachments/notes-sha.pdf",
		undefined,
		expect.anything(),
		"application/pdf",
	);

	// Assert: Image attachment resized and converted; key is the sha with a ".jpeg" extension
	expect(s3.upload).toHaveBeenCalledWith(
		"example-bucket",
		"posts/attachment-post/attachments/banner-sha.jpeg",
		undefined,
		expect.anything(),
		"image/jpeg",
	);

	// Assert: Attachment rows saved with resized image dimensions, null for non-images.
	// The 1x1 fixture is already smaller than the max size, so withoutEnlargement
	// keeps it at 1x1 instead of upscaling it.
	expect(insertAttachmentsValues).toHaveBeenCalledWith({
		attachmentKey: "posts/attachment-post/attachments/index-sha.md",
		sha: "index-sha",
		width: null,
		height: null,
		lastModified: expect.any(Date),
	});
	expect(insertAttachmentsValues).toHaveBeenCalledWith({
		attachmentKey: "posts/attachment-post/attachments/notes-sha.pdf",
		sha: "notes-sha",
		width: null,
		height: null,
		lastModified: expect.any(Date),
	});
	expect(insertAttachmentsValues).toHaveBeenCalledWith({
		attachmentKey: "posts/attachment-post/attachments/banner-sha.jpeg",
		sha: "banner-sha",
		width: 1,
		height: 1,
		lastModified: expect.any(Date),
	});
	expect(insertAttachmentsValues).toHaveBeenCalledTimes(3);
	expect(insertAttachmentOnConflictDoUpdate).toHaveBeenCalledWith({
		target: attachments.attachmentKey,
		set: { lastModified: expect.any(Date) },
	});
});

test("Passes attachment paths to GitHub unchanged, without URL-encoding special characters", async () => {
	vi.mocked(selectExistingAttachments).mockResolvedValue([]);

	const baseFolderPath = "content/example-author/posts/special-chars-post/";
	// A filename with a space and a "#" - naively round-tripping this through
	// `new URL()` would percent-encode the space and treat "#" as a fragment
	// delimiter, truncating the path GitHub actually receives.
	const attachmentName = "my notes #1.txt";

	vi.mocked(github.getContentsRawStream).mockImplementation((params) => {
		if (params.path === `${baseFolderPath}${attachmentName}`) {
			return Promise.resolve({
				data: Readable.toWeb(Readable.from(Buffer.from("notes"))) as never,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	const folder = {
		entries: [
			{
				name: attachmentName,
				path: `${baseFolderPath}${attachmentName}`,
				type: "file",
				sha: "notes-sha",
			},
		],
	};

	await syncAttachments({
		client: github,
		ref: "main",
		folder,
		keyPrefix: "posts/special-chars-post",
		signal: new AbortController().signal,
	});

	// Assert: the raw entry path (with its space and "#" intact) was passed
	// straight through to getContentsRawStream, unencoded
	expect(github.getContentsRawStream).toHaveBeenCalledWith(
		expect.objectContaining({ path: `${baseFolderPath}${attachmentName}` }),
	);
});

test("Diffs post attachments: skips unchanged sha, re-uploads changed sha under a new key, removes deleted", async () => {
	vi.mocked(selectExistingAttachments).mockResolvedValue([
		{
			attachmentKey: "posts/diffing-post/attachments/old-file-sha.txt",
		},
		{
			attachmentKey: "posts/diffing-post/attachments/unchanged-sha.txt",
		},
		{
			attachmentKey: "posts/diffing-post/attachments/old-changed-sha.txt",
		},
	]);

	const baseFolderPath = "content/example-author/posts/diffing-post/";

	vi.mocked(github.getContentsRawStream).mockImplementation((params) => {
		if (params.path === `${baseFolderPath}changed.txt`) {
			return Promise.resolve({
				data: Readable.toWeb(
					Readable.from(Buffer.from("new content")),
				) as never,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	const folder = {
		entries: [
			{
				name: "unchanged.txt",
				path: `${baseFolderPath}unchanged.txt`,
				type: "file",
				sha: "unchanged-sha",
			},
			{
				name: "changed.txt",
				path: `${baseFolderPath}changed.txt`,
				type: "file",
				sha: "new-changed-sha",
			},
		],
	};

	const attachmentRecords = await syncAttachments({
		client: github,
		ref: "main",
		folder,
		keyPrefix: "posts/diffing-post",
		signal: new AbortController().signal,
	});

	expect(attachmentRecords).toEqual([
		{
			attachmentKey: "posts/diffing-post/attachments/unchanged-sha.txt",
			attachmentName: "unchanged.txt",
		},
		{
			attachmentKey: "posts/diffing-post/attachments/new-changed-sha.txt",
			attachmentName: "changed.txt",
		},
	]);

	// Assert: changed attachment's old sha-keyed object was removed, and the
	// new sha-keyed object was uploaded in its place
	expect(s3.upload).toHaveBeenCalledWith(
		"example-bucket",
		"posts/diffing-post/attachments/new-changed-sha.txt",
		undefined,
		expect.anything(),
		"text/plain",
	);

	// Assert: unchanged attachment was NOT re-uploaded or removed
	expect(s3.upload).not.toHaveBeenCalledWith(
		"example-bucket",
		"posts/diffing-post/attachments/unchanged-sha.txt",
		undefined,
		expect.anything(),
		expect.anything(),
	);

	// Assert: only the two attachments still present in the repo are saved
	expect(insertAttachmentsValues).toHaveBeenCalledWith({
		attachmentKey: "posts/diffing-post/attachments/new-changed-sha.txt",
		sha: "new-changed-sha",
		width: null,
		height: null,
		lastModified: expect.any(Date),
	});
	expect(insertAttachmentsValues).toHaveBeenCalledTimes(1);
});

test("Skips an attachment entirely when its sha matches the stored value", async () => {
	vi.mocked(selectExistingAttachments).mockResolvedValue([
		{
			attachmentKey: "posts/skip-post/attachments/unchanged-sha.txt",
		},
	]);

	const baseFolderPath = "content/example-author/posts/skip-post/";

	const folder = {
		entries: [
			{
				name: "unchanged.txt",
				path: `${baseFolderPath}unchanged.txt`,
				type: "file",
				sha: "unchanged-sha",
			},
		],
	};

	const attachmentRecords = await syncAttachments({
		client: github,
		ref: "main",
		folder,
		keyPrefix: "posts/skip-post",
		signal: new AbortController().signal,
	});

	expect(attachmentRecords).toEqual([
		{
			attachmentName: "unchanged.txt",
			attachmentKey: "posts/skip-post/attachments/unchanged-sha.txt",
		},
	]);

	// Assert: the attachment's content was never fetched from GitHub, since its
	// sha already matched the stored row
	expect(github.getContentsRawStream).not.toHaveBeenCalledWith(
		expect.objectContaining({ path: `${baseFolderPath}unchanged.txt` }),
	);

	// Assert: no S3 interaction happened for the attachment itself (content.md
	// is still uploaded separately as part of every sync)
	expect(s3.upload).not.toHaveBeenCalledWith(
		"example-bucket",
		"posts/skip-post/attachments/unchanged-sha.txt",
		expect.anything(),
		expect.anything(),
		expect.anything(),
	);

	// Assert: the existing row was carried forward unchanged
	expect(insertAttachmentsValues).not.toHaveBeenCalled();
});
