import processor from "./processor.ts";
import {
	createJob,
	scheduleS3ObjectDeletion,
	type TaskInputs,
	Tasks,
} from "@playfulprogramming/bullmq";
import type { Job } from "bullmq";
import {
	posts,
	postData,
	postAuthors,
	postTags,
	postAttachments,
	db,
} from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import * as github from "@playfulprogramming/github-api";
import { eq } from "drizzle-orm";
import { Readable } from "node:stream";

const ONE_PIXEL_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg==";

test("Syncs a standalone post successfully", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();
	const insertPostTagsValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		if (table === postAuthors) {
			return { values: insertPostAuthorsValues } as never;
		}
		if (table === postTags) {
			return { values: insertPostTagsValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([]),
		}),
	} as never);

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
	expect(s3.upload).toBeCalledWith(
		"example-bucket",
		"posts/example-post/en/content.md",
		undefined,
		expect.anything(),
		"text/markdown",
	);

	// Assert: Post metadata was saved to database
	expect(insertPostDataValues).toBeCalledWith({
		slug: "example-post",
		locale: "en",
		title: "Example Post",
		version: "",
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

	// Assert: Old authors deleted, new author inserted
	expect(deleteWhere).toBeCalledWith(eq(postAuthors.postSlug, "example-post"));
	expect(insertPostAuthorsValues).toBeCalledWith([
		{
			postSlug: "example-post",
			authorSlug: "example-author",
		},
	]);

	// Assert: Old tags deleted, new tags inserted
	expect(deleteWhere).toBeCalledWith(eq(postTags.postSlug, "example-post"));
	expect(insertPostTagsValues).toBeCalledWith([
		{
			postSlug: "example-post",
			tag: "javascript",
		},
		{
			postSlug: "example-post",
			tag: "tutorial",
		},
	]);
});

test("Syncs a post with a date-only published value", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		if (table === postAuthors) {
			return { values: insertPostAuthorsValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

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

	expect(insertPostDataValues).toBeCalledWith(
		expect.objectContaining({
			slug: "date-only-post",
			title: "Date Only Post",
			publishedAt: new Date("2024-01-15"),
		}),
	);
});

test("Deletes a post record if it no longer exists", async () => {
	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(db.select).mockImplementation(
		() =>
			({
				from: vi.fn((table: unknown) => ({
					where: vi.fn().mockResolvedValue(
						table === postAttachments
							? [
									{
										attachmentKey: "posts/example-post/attachments/notes.pdf",
									},
									{
										attachmentKey: "posts/example-post/attachments/banner.jpeg",
									},
								]
							: [{ authorSlug: "example-author" }, { authorSlug: "co-author" }],
					),
				})),
			}) as never,
	);

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

	// Assert: Post's attachments had their S3 removal scheduled before the cascading delete
	expect(scheduleS3ObjectDeletion).toBeCalledWith(
		"example-bucket",
		"posts/example-post/attachments/notes.pdf",
	);
	expect(scheduleS3ObjectDeletion).toBeCalledWith(
		"example-bucket",
		"posts/example-post/attachments/banner.jpeg",
	);

	// Assert: Post was deleted from posts table (cascade handles related tables)
	expect(db.delete).toBeCalledWith(posts);
	expect(deleteWhere).toBeCalledWith(eq(posts.slug, "example-post"));

	// Assert: Achievements re-evaluated for the authors who were on the post
	expect(createJob).toBeCalledWith(
		Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
		"grant-author-achievements:example-author",
		{ profileSlug: "example-author" },
	);
	expect(createJob).toBeCalledWith(
		Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
		"grant-author-achievements:co-author",
		{ profileSlug: "co-author" },
	);
});

test("Links post to collection when collection is provided", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		if (table === postAuthors) {
			return { values: insertPostAuthorsValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([]),
		}),
	} as never);

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
	expect(insertPostsValues).toBeCalledWith({
		slug: "example-post",
		collectionSlug: "example-collection",
		collectionOrder: 1,
	});
});

test("Syncs post with multiple locales", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		if (table === postAuthors) {
			return { values: insertPostAuthorsValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([]),
		}),
	} as never);

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
	expect(s3.upload).toBeCalledWith(
		"example-bucket",
		"posts/multilang-post/en/content.md",
		undefined,
		expect.anything(),
		"text/markdown",
	);
	expect(s3.upload).toBeCalledWith(
		"example-bucket",
		"posts/multilang-post/es/content.md",
		undefined,
		expect.anything(),
		"text/markdown",
	);

	// Assert: Both locales were saved to database
	expect(insertPostDataValues).toBeCalledWith(
		expect.objectContaining({
			slug: "multilang-post",
			locale: "en",
			title: "English Post",
		}),
	);
	expect(insertPostDataValues).toBeCalledWith(
		expect.objectContaining({
			slug: "multilang-post",
			locale: "es",
			title: "Post en Español",
		}),
	);
});

test("Handles post with multiple authors", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		if (table === postAuthors) {
			return { values: insertPostAuthorsValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([]),
		}),
	} as never);

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
	expect(insertPostAuthorsValues).toBeCalledWith([
		{
			postSlug: "collab-post",
			authorSlug: "example-author",
		},
		{
			postSlug: "collab-post",
			authorSlug: "co-author",
		},
	]);
});

test("Unions tags across all locales", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();
	const insertPostTagsValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		if (table === postAuthors) {
			return { values: insertPostAuthorsValues } as never;
		}
		if (table === postTags) {
			return { values: insertPostTagsValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

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

	// Assert: Tags from both locales are unioned, with duplicates deduped
	expect(insertPostTagsValues).toBeCalledWith([
		{
			postSlug: "multilang-tags-post",
			tag: "javascript",
		},
		{
			postSlug: "multilang-tags-post",
			tag: "tutorial",
		},
		{
			postSlug: "multilang-tags-post",
			tag: "espanol",
		},
	]);
});

test("Uploads post attachments, resizing images and content-addressing their keys by sha", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();
	const insertPostAttachmentsValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		if (table === postAuthors) {
			return { values: insertPostAuthorsValues } as never;
		}
		if (table === postAttachments) {
			return { values: insertPostAttachmentsValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([]),
		}),
	} as never);

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
	expect(s3.upload).toBeCalledWith(
		"example-bucket",
		"posts/attachment-post/attachments/notes-sha.pdf",
		undefined,
		expect.anything(),
		"application/pdf",
	);

	// Assert: Image attachment resized and converted; key is the sha with a ".jpeg" extension
	expect(s3.upload).toBeCalledWith(
		"example-bucket",
		"posts/attachment-post/attachments/banner-sha.jpeg",
		undefined,
		expect.anything(),
		"image/jpeg",
	);

	// Assert: Attachment rows saved with resized image dimensions, null for non-images.
	// The 1x1 fixture is already smaller than the max size, so withoutEnlargement
	// keeps it at 1x1 instead of upscaling it.
	expect(insertPostAttachmentsValues).toBeCalledWith([
		{
			postSlug: "attachment-post",
			attachmentName: "notes.pdf",
			attachmentKey: "posts/attachment-post/attachments/notes-sha.pdf",
			sha: "notes-sha",
			width: null,
			height: null,
		},
		{
			postSlug: "attachment-post",
			attachmentName: "banner.png",
			attachmentKey: "posts/attachment-post/attachments/banner-sha.jpeg",
			sha: "banner-sha",
			width: 1,
			height: 1,
		},
	]);
});

test("Passes attachment paths to GitHub unchanged, without URL-encoding special characters", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();
	const insertPostAttachmentsValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		if (table === postAuthors) {
			return { values: insertPostAuthorsValues } as never;
		}
		if (table === postAttachments) {
			return { values: insertPostAttachmentsValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([]),
		}),
	} as never);

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
	expect(github.getContentsRawStream).toBeCalledWith(
		expect.objectContaining({ path: `${baseFolderPath}${attachmentName}` }),
	);
});

test("Diffs post attachments: skips unchanged sha, re-uploads changed sha under a new key, removes deleted", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();
	const insertPostAttachmentsValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		if (table === postAuthors) {
			return { values: insertPostAuthorsValues } as never;
		}
		if (table === postAttachments) {
			return { values: insertPostAttachmentsValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(db.select).mockImplementation(
		() =>
			({
				from: vi.fn((table: unknown) => ({
					where: vi.fn().mockResolvedValue(
						table === postAttachments
							? [
									{
										attachmentName: "old-file.txt",
										attachmentKey:
											"posts/diffing-post/attachments/old-file-sha.txt",
										sha: "old-file-sha",
										width: null,
										height: null,
									},
									{
										attachmentName: "unchanged.txt",
										attachmentKey:
											"posts/diffing-post/attachments/unchanged-sha.txt",
										sha: "unchanged-sha",
										width: null,
										height: null,
									},
									{
										attachmentName: "changed.txt",
										attachmentKey:
											"posts/diffing-post/attachments/old-changed-sha.txt",
										sha: "old-changed-sha",
										width: null,
										height: null,
									},
								]
							: [],
					),
				})),
			}) as never,
	);

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

	// Assert: attachment no longer in the repo had its S3 removal scheduled
	expect(scheduleS3ObjectDeletion).toBeCalledWith(
		"example-bucket",
		"posts/diffing-post/attachments/old-file-sha.txt",
	);

	// Assert: changed attachment's old sha-keyed object had its removal
	// scheduled, and the new sha-keyed object was uploaded in its place
	expect(scheduleS3ObjectDeletion).toBeCalledWith(
		"example-bucket",
		"posts/diffing-post/attachments/old-changed-sha.txt",
	);
	expect(s3.upload).toBeCalledWith(
		"example-bucket",
		"posts/diffing-post/attachments/new-changed-sha.txt",
		undefined,
		expect.anything(),
		"text/plain",
	);

	// Assert: the new object is uploaded before the old one's removal is
	// scheduled, so a failed upload can't leave the persisted row pointing at
	// a deleted key
	const newKeyUploadOrder = vi
		.mocked(s3.upload)
		.mock.calls.findIndex(
			(call) =>
				call[1] === "posts/diffing-post/attachments/new-changed-sha.txt",
		);
	const oldKeyRemoveOrder = vi
		.mocked(scheduleS3ObjectDeletion)
		.mock.calls.findIndex(
			(call) =>
				call[1] === "posts/diffing-post/attachments/old-changed-sha.txt",
		);
	expect(
		vi.mocked(s3.upload).mock.invocationCallOrder[newKeyUploadOrder],
	).toBeLessThan(
		vi.mocked(scheduleS3ObjectDeletion).mock.invocationCallOrder[
			oldKeyRemoveOrder
		],
	);

	// Assert: unchanged attachment was NOT re-uploaded or scheduled for removal
	expect(s3.upload).not.toBeCalledWith(
		"example-bucket",
		"posts/diffing-post/attachments/unchanged-sha.txt",
		undefined,
		expect.anything(),
		expect.anything(),
	);
	expect(scheduleS3ObjectDeletion).not.toBeCalledWith(
		"example-bucket",
		"posts/diffing-post/attachments/unchanged-sha.txt",
	);

	// Assert: only the two attachments still present in the repo are saved
	expect(insertPostAttachmentsValues).toBeCalledWith([
		{
			postSlug: "diffing-post",
			attachmentName: "unchanged.txt",
			attachmentKey: "posts/diffing-post/attachments/unchanged-sha.txt",
			sha: "unchanged-sha",
			width: null,
			height: null,
		},
		{
			postSlug: "diffing-post",
			attachmentName: "changed.txt",
			attachmentKey: "posts/diffing-post/attachments/new-changed-sha.txt",
			sha: "new-changed-sha",
			width: null,
			height: null,
		},
	]);
});

test("Skips an attachment entirely when its sha matches the stored value", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();
	const insertPostAttachmentsValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		if (table === postAuthors) {
			return { values: insertPostAuthorsValues } as never;
		}
		if (table === postAttachments) {
			return { values: insertPostAttachmentsValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(db.select).mockImplementation(
		() =>
			({
				from: vi.fn((table: unknown) => ({
					where: vi.fn().mockResolvedValue(
						table === postAttachments
							? [
									{
										attachmentName: "unchanged.txt",
										attachmentKey:
											"posts/skip-post/attachments/unchanged-sha.txt",
										sha: "unchanged-sha",
										width: null,
										height: null,
									},
								]
							: [],
					),
				})),
			}) as never,
	);

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
	expect(github.getContentsRawStream).not.toBeCalledWith(
		expect.objectContaining({ path: `${baseFolderPath}unchanged.txt` }),
	);

	// Assert: no S3 interaction happened for the attachment itself (content.md
	// is still uploaded separately as part of every sync)
	expect(s3.upload).not.toBeCalledWith(
		"example-bucket",
		"posts/skip-post/attachments/unchanged-sha.txt",
		expect.anything(),
		expect.anything(),
		expect.anything(),
	);
	expect(scheduleS3ObjectDeletion).not.toBeCalled();

	// Assert: the existing row was carried forward unchanged
	expect(insertPostAttachmentsValues).toBeCalledWith([
		{
			postSlug: "skip-post",
			attachmentName: "unchanged.txt",
			attachmentKey: "posts/skip-post/attachments/unchanged-sha.txt",
			sha: "unchanged-sha",
			width: null,
			height: null,
		},
	]);
});
