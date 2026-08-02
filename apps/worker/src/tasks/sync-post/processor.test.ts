import processor from "./processor.ts";
import { createJob, type TaskInputs, Tasks } from "@playfulprogramming/bullmq";
import type { Job } from "bullmq";
import {
	posts,
	postAuthors,
	postTags,
	postAttachments,
	db,
	attachments,
} from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import * as github from "@playfulprogramming/github-api";
import { and, eq } from "drizzle-orm";
import { Readable } from "node:stream";

const ONE_PIXEL_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg==";

const selectExistingAttachments = db
	.select(expect.anything())
	.from(attachments)
	.innerJoin(expect.anything(), expect.anything())
	.innerJoin(expect.anything(), expect.anything()).where;
const selectPreviousAuthors = db
	.select(expect.anything())
	.from(posts)
	.innerJoin(postAuthors, expect.anything()).where;
const insertPostReturning = db
	.insert(posts)
	.values(expect.anything()).returning;

test("Syncs a standalone post successfully", async () => {
	const postId = ":test-post-uuid:";

	vi.mocked(selectPreviousAuthors).mockResolvedValue([]);
	vi.mocked(selectExistingAttachments).mockResolvedValue([]);
	vi.mocked(insertPostReturning).mockResolvedValue([{ id: postId }]);

	// Mock GitHub: return folder listing with index.md
	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === "/content/example-author/posts/example-post/") {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: "content/example-author/posts/example-post/index.md",
						},
					],
				},
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	// Mock GitHub: return markdown content
	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === "/content/example-author/posts/example-post/index.md") {
			return Promise.resolve({
				data: `---
title: "Example Post"
description: "A test post"
published: "2024-01-15T00:00:00Z"
tags:
  - javascript
  - tutorial
---

# Hello World

This is the post content.
`,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	// Run the processor
	await processor({
		data: {
			author: "example-author",
			post: "example-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

	// Assert: Markdown was uploaded to S3
	expect(s3.upload).toHaveBeenCalledWith(
		"example-bucket",
		"posts/example-post/en/content.md",
		undefined,
		expect.anything(),
		"text/markdown",
	);

	// Assert: Post metadata was saved to database
	expect(db.insert(posts).values).toHaveBeenCalledWith({
		slug: "example-post",
		locale: "en",
		branch: "main",
		collectionOrder: undefined,
		title: "Example Post",
		versionName: "",
		description: "A test post",
		wordCount: 10,
		socialImage: null,
		bannerImage: null,
		originalLink: null,
		noindex: false,
		editedAt: null,
		publishedAt: new Date("2024-01-15T00:00:00Z"),
		meta: {
			tags: ["javascript", "tutorial"],
		},
	});

	expect(db.insert(postAuthors).values).toHaveBeenCalledWith([
		{
			postId,
			authorSlug: "example-author",
		},
	]);

	expect(db.insert(postTags).values).toHaveBeenCalledWith([
		{
			postId,
			tag: "javascript",
		},
		{
			postId,
			tag: "tutorial",
		},
	]);
});

test("Syncs a post with a date-only published value", async () => {
	const postId = ":test-post-uuid:";

	vi.mocked(selectExistingAttachments).mockResolvedValue([]);
	vi.mocked(selectPreviousAuthors).mockResolvedValue([]);
	vi.mocked(insertPostReturning).mockResolvedValue([{ id: postId }]);

	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === "/content/example-author/posts/date-only-post/") {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: "content/example-author/posts/date-only-post/index.md",
						},
					],
				},
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (
			params.path === "/content/example-author/posts/date-only-post/index.md"
		) {
			return Promise.resolve({
				data: `---
title: "Date Only Post"
description: "A test post with a date-only published value"
published: "2024-01-15"
---

# Hello World

This is the post content.
`,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	await processor({
		data: {
			author: "example-author",
			post: "date-only-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

	expect(db.insert(posts).values).toHaveBeenCalledWith(
		expect.objectContaining({
			title: "Date Only Post",
			publishedAt: new Date("2024-01-15"),
		}),
	);
});

test("Deletes a post record if it no longer exists", async () => {
	vi.mocked(
		db.delete(posts).where(expect.anything()).returning,
	).mockResolvedValue([{ id: ":deleted-post-id:" }]);
	vi.mocked(
		db.select(expect.anything()).from(postAuthors).where,
	).mockResolvedValue([
		{ authorSlug: "example-author" },
		{ authorSlug: "co-author" },
	]);

	// Mock GitHub: return 404
	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === "/content/example-author/posts/example-post/") {
			return Promise.resolve({
				data: undefined,
				status: 404,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	// Run the processor
	await processor({
		data: {
			author: "example-author",
			post: "example-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

	// Assert: Post was deleted from posts table (cascade handles related tables)
	expect(db.delete(posts).where).toHaveBeenCalledWith(
		and(eq(posts.slug, "example-post"), eq(posts.branch, "main")),
	);

	// Assert: Achievements re-evaluated for the authors who were on the post
	expect(createJob).toHaveBeenCalledWith(
		Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
		"grant-author-achievements:example-author",
		{ profileSlug: "example-author" },
	);
	expect(createJob).toHaveBeenCalledWith(
		Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
		"grant-author-achievements:co-author",
		{ profileSlug: "co-author" },
	);
});

test("Links post to collection when collection is provided", async () => {
	const postId = ":post-with-collection-uuid:";

	vi.mocked(selectExistingAttachments).mockResolvedValue([]);
	vi.mocked(selectPreviousAuthors).mockResolvedValue([]);
	vi.mocked(insertPostReturning).mockResolvedValue([{ id: postId }]);

	// Note: collection path format
	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (
			params.path ===
			"/content/example-author/collections/example-collection/posts/example-post/"
		) {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: "content/example-author/collections/example-collection/posts/example-post/index.md",
						},
					],
				},
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (
			params.path ===
			"/content/example-author/collections/example-collection/posts/example-post/index.md"
		) {
			return Promise.resolve({
				data: `---
title: "Chapter One"
description: "The first chapter"
published: "2024-01-15T00:00:00Z"
order: 1
---
`,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	// Run with collection provided
	await processor({
		data: {
			author: "example-author",
			collection: "example-collection",
			post: "example-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

	// Assert: Collection chapter was referenced
	expect(db.insert(posts).values).toHaveBeenCalledWith(
		expect.objectContaining({
			slug: "example-post",
			locale: "en",
			branch: "main",
			groupId: undefined,
			collectionSlug: "example-collection",
			collectionOrder: 1,
		}),
	);
});

test("Syncs post with multiple locales", async () => {
	const postIdEn = ":multilang-post-en:";
	const postIdEs = ":multilang-post-es:";

	vi.mocked(selectExistingAttachments).mockResolvedValue([]);
	vi.mocked(selectPreviousAuthors).mockResolvedValue([]);
	vi.mocked(insertPostReturning)
		.mockResolvedValueOnce([{ id: postIdEn }])
		.mockResolvedValueOnce([{ id: postIdEs }]);

	// Return folder listing with both index.md and index.es.md
	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === "/content/example-author/posts/multilang-post/") {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: "content/example-author/posts/multilang-post/index.md",
						},
						{
							name: "index.es.md",
							path: "content/example-author/posts/multilang-post/index.es.md",
						},
					],
				},
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (
			params.path === "/content/example-author/posts/multilang-post/index.md"
		) {
			return Promise.resolve({
				data: `---
title: "English Post"
published: "2024-01-15T00:00:00Z"
---
`,
				status: 200,
			});
		}
		if (
			params.path === "/content/example-author/posts/multilang-post/index.es.md"
		) {
			return Promise.resolve({
				data: `---
title: "Post en Español"
published: "2024-01-15T00:00:00Z"
---
`,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	await processor({
		data: {
			author: "example-author",
			post: "multilang-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

	// Assert: Both locales were uploaded to S3
	expect(s3.upload).toHaveBeenCalledWith(
		"example-bucket",
		"posts/multilang-post/en/content.md",
		undefined,
		expect.anything(),
		"text/markdown",
	);
	expect(s3.upload).toHaveBeenCalledWith(
		"example-bucket",
		"posts/multilang-post/es/content.md",
		undefined,
		expect.anything(),
		"text/markdown",
	);

	// Assert: Both locales were saved to database
	expect(db.insert(posts).values).toHaveBeenCalledWith(
		expect.objectContaining({
			slug: "multilang-post",
			title: "English Post",
			locale: "en",
		}),
	);
	expect(db.insert(posts).values).toHaveBeenCalledWith(
		expect.objectContaining({
			slug: "multilang-post",
			title: "Post en Español",
			locale: "es",
		}),
	);
});

test("Handles post with multiple authors", async () => {
	const postId = ":test-post-uuid:";

	vi.mocked(selectExistingAttachments).mockResolvedValue([]);
	vi.mocked(selectPreviousAuthors).mockResolvedValue([]);
	vi.mocked(insertPostReturning).mockResolvedValue([{ id: postId }]);

	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === "/content/example-author/posts/collab-post/") {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: "content/example-author/posts/collab-post/index.md",
						},
					],
				},
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === "/content/example-author/posts/collab-post/index.md") {
			return Promise.resolve({
				data: `---
title: "Collaborative Post"
published: "2024-01-15T00:00:00Z"
authors:
  - co-author
---
`,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	await processor({
		data: {
			author: "example-author",
			post: "collab-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

	// Assert: Both authors should be inserted (folder owner first, then co-author from frontmatter)
	expect(db.insert(postAuthors).values).toHaveBeenCalledWith([
		{
			postId,
			authorSlug: "example-author",
		},
		{
			postId,
			authorSlug: "co-author",
		},
	]);
});

test("Differentiates tags between locales", async () => {
	const postIdEn = ":multilang-post-en:";
	const postIdEs = ":multilang-post-es:";

	vi.mocked(selectExistingAttachments).mockResolvedValue([]);
	vi.mocked(selectPreviousAuthors).mockResolvedValue([]);
	vi.mocked(insertPostReturning)
		.mockResolvedValueOnce([{ id: postIdEn }])
		.mockResolvedValueOnce([{ id: postIdEs }]);

	// Return folder listing with both index.md and index.es.md
	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === "/content/example-author/posts/multilang-tags-post/") {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: "content/example-author/posts/multilang-tags-post/index.md",
						},
						{
							name: "index.es.md",
							path: "content/example-author/posts/multilang-tags-post/index.es.md",
						},
					],
				},
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (
			params.path ===
			"/content/example-author/posts/multilang-tags-post/index.md"
		) {
			return Promise.resolve({
				data: `---
title: "English Post"
published: "2024-01-15T00:00:00Z"
tags:
  - javascript
  - tutorial
---
`,
				status: 200,
			});
		}
		if (
			params.path ===
			"/content/example-author/posts/multilang-tags-post/index.es.md"
		) {
			return Promise.resolve({
				data: `---
title: "Post en Español"
published: "2024-01-15T00:00:00Z"
tags:
  - tutorial
  - espanol
---
`,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	await processor({
		data: {
			author: "example-author",
			post: "multilang-tags-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

	// Assert: Tags from each locale are correctly linked
	expect(db.insert(postTags).values).toHaveBeenCalledWith([
		{
			postId: postIdEn,
			tag: "javascript",
		},
		{
			postId: postIdEn,
			tag: "tutorial",
		},
	]);

	expect(db.insert(postTags).values).toHaveBeenCalledWith([
		{
			postId: postIdEs,
			tag: "tutorial",
		},
		{
			postId: postIdEs,
			tag: "espanol",
		},
	]);
});

test("Uploads post attachments, resizing images and content-addressing their keys by sha", async () => {
	const postId = ":post-attachment-id:";
	vi.mocked(selectExistingAttachments).mockResolvedValue([]);
	vi.mocked(selectPreviousAuthors).mockResolvedValue([]);
	vi.mocked(insertPostReturning).mockResolvedValue([{ id: postId }]);

	const basePath = "/content/example-author/posts/attachment-post/";
	const baseFolderPath = "content/example-author/posts/attachment-post/";

	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === basePath) {
			return Promise.resolve({
				data: {
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
				},
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === `/${baseFolderPath}index.md`) {
			return Promise.resolve({
				data: `---
title: "Attachment Post"
published: "2024-01-15T00:00:00Z"
---
`,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	vi.mocked(github.getContentsRawStream).mockImplementation((params) => {
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

	await processor({
		data: {
			author: "example-author",
			post: "attachment-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

	// Assert: Non-image attachment uploaded as-is, keyed by its sha and original extension
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
	expect(db.insert(attachments).values).toHaveBeenCalledWith({
		attachmentKey: "posts/attachment-post/attachments/notes-sha.pdf",
		sha: "notes-sha",
		width: null,
		height: null,
	});
	expect(db.insert(attachments).values).toHaveBeenCalledWith({
		attachmentKey: "posts/attachment-post/attachments/banner-sha.jpeg",
		sha: "banner-sha",
		width: 1,
		height: 1,
	});
	expect(db.insert(attachments).values).toHaveBeenCalledTimes(2);

	expect(db.insert(postAttachments).values).toHaveBeenCalledExactlyOnceWith([
		{
			postId,
			attachmentKey: "posts/attachment-post/attachments/notes-sha.pdf",
			attachmentName: "notes.pdf",
		},
		{
			postId,
			attachmentKey: "posts/attachment-post/attachments/banner-sha.jpeg",
			attachmentName: "banner.png",
		},
	]);
});

test("Passes attachment paths to GitHub unchanged, without URL-encoding special characters", async () => {
	const postId = ":post-attachment-id:";
	vi.mocked(selectExistingAttachments).mockResolvedValue([]);
	vi.mocked(selectPreviousAuthors).mockResolvedValue([]);
	vi.mocked(insertPostReturning).mockResolvedValue([{ id: postId }]);

	const basePath = "/content/example-author/posts/special-chars-post/";
	const baseFolderPath = "content/example-author/posts/special-chars-post/";
	// A filename with a space and a "#" - naively round-tripping this through
	// `new URL()` would percent-encode the space and treat "#" as a fragment
	// delimiter, truncating the path GitHub actually receives.
	const attachmentName = "my notes #1.txt";

	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === basePath) {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: `${baseFolderPath}index.md`,
							type: "file",
							sha: "index-sha",
						},
						{
							name: attachmentName,
							path: `${baseFolderPath}${attachmentName}`,
							type: "file",
							sha: "notes-sha",
						},
					],
				},
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === `/${baseFolderPath}index.md`) {
			return Promise.resolve({
				data: `---
title: "Special Chars Post"
published: "2024-01-15T00:00:00Z"
---
`,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	vi.mocked(github.getContentsRawStream).mockImplementation((params) => {
		if (params.path === `${baseFolderPath}${attachmentName}`) {
			return Promise.resolve({
				data: Readable.toWeb(Readable.from(Buffer.from("notes"))) as never,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	await processor({
		data: {
			author: "example-author",
			post: "special-chars-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

	// Assert: the raw entry path (with its space and "#" intact) was passed
	// straight through to getContentsRawStream, unencoded
	expect(github.getContentsRawStream).toHaveBeenCalledWith(
		expect.objectContaining({ path: `${baseFolderPath}${attachmentName}` }),
	);
});

test("Diffs post attachments: skips unchanged sha, re-uploads changed sha under a new key, removes deleted", async () => {
	const postId = ":post-attachment-id:";
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
	vi.mocked(selectPreviousAuthors).mockResolvedValue([]);
	vi.mocked(insertPostReturning).mockResolvedValue([{ id: postId }]);

	const basePath = "/content/example-author/posts/diffing-post/";
	const baseFolderPath = "content/example-author/posts/diffing-post/";

	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === basePath) {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: `${baseFolderPath}index.md`,
							type: "file",
							sha: "index-sha",
						},
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
				},
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === `/${baseFolderPath}index.md`) {
			return Promise.resolve({
				data: `---
title: "Diffing Post"
published: "2024-01-15T00:00:00Z"
---
`,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

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

	await processor({
		data: {
			author: "example-author",
			post: "diffing-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

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
	expect(db.insert(attachments).values).toHaveBeenCalledWith({
		attachmentKey: "posts/diffing-post/attachments/new-changed-sha.txt",
		sha: "new-changed-sha",
		width: null,
		height: null,
	});
	expect(db.insert(attachments).values).toHaveBeenCalledTimes(1);

	expect(db.insert(postAttachments).values).toHaveBeenCalledExactlyOnceWith([
		{
			attachmentKey: "posts/diffing-post/attachments/unchanged-sha.txt",
			attachmentName: "unchanged.txt",
			postId,
		},
		{
			attachmentKey: "posts/diffing-post/attachments/new-changed-sha.txt",
			attachmentName: "changed.txt",
			postId,
		},
	]);
});

test("Skips an attachment entirely when its sha matches the stored value", async () => {
	const postId = ":test-post-id:";
	vi.mocked(selectExistingAttachments).mockResolvedValue([
		{
			attachmentKey: "posts/skip-post/attachments/unchanged-sha.txt",
		},
	]);
	vi.mocked(selectPreviousAuthors).mockResolvedValue([]);
	vi.mocked(insertPostReturning).mockResolvedValue([{ id: postId }]);

	const basePath = "/content/example-author/posts/skip-post/";
	const baseFolderPath = "content/example-author/posts/skip-post/";

	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === basePath) {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: `${baseFolderPath}index.md`,
							type: "file",
							sha: "index-sha",
						},
						{
							name: "unchanged.txt",
							path: `${baseFolderPath}unchanged.txt`,
							type: "file",
							sha: "unchanged-sha",
						},
					],
				},
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === `/${baseFolderPath}index.md`) {
			return Promise.resolve({
				data: `---
title: "Skip Post"
published: "2024-01-15T00:00:00Z"
---
`,
				status: 200,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	await processor({
		data: {
			author: "example-author",
			post: "skip-post",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-post"]>);

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
	expect(db.insert(attachments).values).not.toHaveBeenCalled();
	expect(db.insert(postAttachments).values).toHaveBeenCalledExactlyOnceWith([
		{
			attachmentName: "unchanged.txt",
			attachmentKey: "posts/skip-post/attachments/unchanged-sha.txt",
			postId,
		},
	]);
});
