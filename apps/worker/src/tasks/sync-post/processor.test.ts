import processor from "./processor.ts";
import { createJob, Tasks } from "@playfulprogramming/bullmq";
import type { Job } from "bullmq";
import {
	posts,
	postAuthors,
	postTags,
	db,
	attachments,
	postAttachments,
} from "@playfulprogramming/db";
import { createInstallationClient } from "@playfulprogramming/github-api";
import { and, eq } from "drizzle-orm";

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
const github = await createInstallationClient(0);

vi.mock(import("../../sync/attachments.ts"), async (importOriginal) => {
	const original = await importOriginal();
	return {
		syncAttachments: vi.fn(original.syncAttachmentsFake),
		resolveAttachment: vi.fn(original.resolveAttachment),
	};
});

function fakeJob<Data>(data: Data): Job<Data> {
	return { data } as unknown as Job<Data>;
}

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
							type: "file",
							sha: "index-sha",
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
	await processor(
		fakeJob({
			author: "example-author",
			post: "example-post",
			ref: "main",
			installation: { id: 0 },
		}),
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

	// Assert: Markdown was added as an attachment
	expect(db.insert(postAttachments).values).toHaveBeenCalledWith([
		{
			postId,
			attachmentKey: "posts/example-post/attachments/index-sha.md",
			attachmentName: "index.md",
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

	await processor(
		fakeJob({
			author: "example-author",
			post: "date-only-post",
			ref: "main",
			installation: { id: 0 },
		}),
	);

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
	await processor(
		fakeJob({
			author: "example-author",
			post: "example-post",
			ref: "main",
			installation: { id: 0 },
		}),
	);

	// Assert: Post was deleted from posts table (cascade handles related tables)
	expect(db.delete(posts).where).toHaveBeenCalledWith(
		and(eq(posts.slug, "example-post"), eq(posts.branch, "main")),
	);

	// Assert: Achievements re-evaluated for the authors who were on the post
	expect(createJob).toHaveBeenCalledWith(
		Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
		"grant-author-achievements:example-author",
		{ authorSlug: "example-author", installation: { id: 0 } },
	);
	expect(createJob).toHaveBeenCalledWith(
		Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
		"grant-author-achievements:co-author",
		{ authorSlug: "co-author", installation: { id: 0 } },
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
	await processor(
		fakeJob({
			author: "example-author",
			collection: "example-collection",
			post: "example-post",
			ref: "main",
			installation: { id: 0 },
		}),
	);

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
							sha: "index-en-sha",
						},
						{
							name: "index.es.md",
							path: "content/example-author/posts/multilang-post/index.es.md",
							sha: "index-es-sha",
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

	await processor(
		fakeJob({
			author: "example-author",
			post: "multilang-post",
			ref: "main",
			installation: { id: 0 },
		}),
	);

	// Assert: Both locales inserted as attachments
	expect(db.insert(postAttachments).values).toHaveBeenCalledWith([
		{
			postId: postIdEn,
			attachmentKey: "posts/multilang-post/attachments/index-en-sha.md",
			attachmentName: "index.md",
		},
		{
			postId: postIdEn,
			attachmentKey: "posts/multilang-post/attachments/index-es-sha.md",
			attachmentName: "index.es.md",
		},
	]);
	expect(db.insert(postAttachments).values).toHaveBeenCalledWith([
		{
			postId: postIdEs,
			attachmentKey: "posts/multilang-post/attachments/index-en-sha.md",
			attachmentName: "index.md",
		},
		{
			postId: postIdEs,
			attachmentKey: "posts/multilang-post/attachments/index-es-sha.md",
			attachmentName: "index.es.md",
		},
	]);
	expect(db.insert(postAttachments).values).toHaveBeenCalledTimes(2);

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

	await processor(
		fakeJob({
			author: "example-author",
			post: "collab-post",
			ref: "main",
			installation: { id: 0 },
		}),
	);

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

	await processor(
		fakeJob({
			author: "example-author",
			post: "multilang-tags-post",
			ref: "main",
			installation: { id: 0 },
		}),
	);

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
