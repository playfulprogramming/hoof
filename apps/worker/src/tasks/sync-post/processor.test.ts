import processor from "./processor.ts";
import type { TaskInputs } from "@playfulprogramming/common";
import type { Job } from "bullmq";
import {
	posts,
	postData,
	postAuthors,
	collectionChapters,
	db,
} from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import * as github from "@playfulprogramming/github-api";
import { eq } from "drizzle-orm";

/**
 * Test 1: Basic post sync (standalone, single locale)
 *
 * Scenario: A post exists at content/example-author/posts/example-post/index.md
 * Expected: Upload markdown to S3, save metadata to DB, link author
 */
test("Syncs a standalone post successfully", async () => {
	// Mock db.insert to track what gets inserted
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

	// Mock db.delete for author cleanup
	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	// Mock db.select to return the author exists
	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([{ slug: "example-author" }]),
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
				error: undefined,
				response: {} as never,
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
				response: {} as never,
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
});

/**
 * Test 2: Post deletion (404 case)
 *
 * Scenario: A post no longer exists in GitHub
 * Expected: Remove from postData and collectionChapters
 */
test("Deletes a post record if it no longer exists", async () => {
	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	// Mock GitHub: return 404
	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (params.path === "/content/example-author/posts/example-post/") {
			return Promise.resolve({
				data: undefined,
				error: {},
				response: {
					status: 404,
				} as never,
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

	// Assert: Post was deleted from database
	expect(deleteWhere).toBeCalledWith(eq(postData.slug, "example-post"));

	// Assert: Collection chapters were also deleted
	expect(deleteWhere).toBeCalledWith(
		eq(collectionChapters.postSlug, "example-post"),
	);
});

/**
 * Test 3: Post with missing author profile
 *
 * Scenario: Post references an author that doesn't exist in profiles
 * Expected: Throw error
 */
test("Fails if author profile does not exist", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === posts) {
			return { values: insertPostsValues } as never;
		}
		if (table === postData) {
			return { values: insertPostDataValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	vi.mocked(db.delete).mockReturnValue({
		where: vi.fn(),
	} as never);

	// Return empty array - author does not exist
	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([]),
		}),
	} as never);

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
				error: undefined,
				response: {} as never,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === "/content/example-author/posts/example-post/index.md") {
			return Promise.resolve({
				data: `---
title: "Example Post"
published: "2024-01-15T00:00:00Z"
---
`,
				response: {} as never,
			});
		}
		return Promise.reject(new Error(`Unexpected path: ${params.path}`));
	});

	// Assert: Should throw error about missing author
	await expect(
		processor({
			data: {
				author: "example-author",
				post: "example-post",
				ref: "main",
			},
		} as unknown as Job<TaskInputs["sync-post"]>),
	).rejects.toThrow(
		"Author profiles not found for post example-post: example-author",
	);
});

/**
 * Test 4: Post in a collection
 *
 * Scenario: A post is part of a collection
 * Expected: Also insert into collectionChapters
 */
test("Links post to collection when collection is provided", async () => {
	const insertPostsValues = vi.fn().mockReturnValue({
		onConflictDoNothing: vi.fn(),
	});
	const insertPostDataValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertPostAuthorsValues = vi.fn();
	const insertCollectionChaptersValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});

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
		if (table === collectionChapters) {
			return { values: insertCollectionChaptersValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([{ slug: "example-author" }]),
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
				error: undefined,
				response: {} as never,
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
				response: {} as never,
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

	// Assert: Collection chapter was inserted
	expect(insertCollectionChaptersValues).toBeCalledWith({
		locale: "en",
		collectionSlug: "example-collection",
		postSlug: "example-post",
		title: "Chapter One",
		description: "The first chapter",
		url: "/example-author/posts/example-post",
		order: 1,
	});
});

/**
 * Test 5: Post with multiple locales
 *
 * Scenario: A post has both index.md and index.es.md
 * Expected: Both locales are processed and saved to S3/DB
 */
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
			where: vi.fn().mockResolvedValue([{ slug: "example-author" }]),
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
				error: undefined,
				response: {} as never,
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
				response: {} as never,
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
				response: {} as never,
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

/**
 * Test 6: Post with multiple authors
 *
 * Scenario: A post has authors specified in frontmatter
 * Expected: Both frontmatter authors and folder owner are linked
 */
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

	// Both authors exist
	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi
				.fn()
				.mockResolvedValue([{ slug: "example-author" }, { slug: "co-author" }]),
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
				error: undefined,
				response: {} as never,
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
				response: {} as never,
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
