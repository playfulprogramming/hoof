import processor from "./processor.ts";
import type { TaskInputs } from "@playfulprogramming/common";
import type { Job } from "bullmq";
import { collectionAuthors, collectionData, db } from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import * as github from "@playfulprogramming/github-api";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";

const mockImage = `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`;

test("Creates an example collection successfully", async () => {
	const insertCollectionValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertAuthorValues = vi.fn();
	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === collectionData) {
			return { values: insertCollectionValues } as never;
		}
		if (table === collectionAuthors) {
			return { values: insertAuthorValues } as never;
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

	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (
			params.path === "/content/example-author/collections/example-collection/"
		) {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: "content/example-author/collections/example-collection/index.md",
						},
					],
				},
				error: undefined,
				response: {} as never,
			});
		}
		return Promise.reject();
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (
			params.path ===
			"/content/example-author/collections/example-collection/index.md"
		) {
			return Promise.resolve({
				data: `---
title: "Example Collection"
description: "A test collection"
coverImg: "./cover.png"
published: "2023-01-01T00:00:00Z"
---
`,
				response: {} as never,
			});
		}
		return Promise.reject();
	});

	vi.mocked(github.getContentsRawStream).mockImplementation((params) => {
		if (
			params.path ===
			"/content/example-author/collections/example-collection/cover.png"
		) {
			const buffer = Buffer.from(mockImage, "base64");
			return Promise.resolve({
				data: Readable.toWeb(Readable.from(buffer)) as never,
				response: {} as never,
			});
		}
		return Promise.reject();
	});

	await processor({
		data: {
			author: "example-author",
			collection: "example-collection",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-collection"]>);

	// The cover image was uploaded to S3
	expect(s3.upload).toBeCalledWith(
		"example-bucket",
		"collections/example-collection/en/cover.jpg",
		undefined,
		expect.anything(),
		"image/jpeg",
	);

	// The collection was inserted into the database
	expect(insertCollectionValues).toBeCalledWith({
		slug: "example-collection",
		locale: "en",
		title: "Example Collection",
		description: "A test collection",
		coverImage: "collections/example-collection/en/cover.jpg",
		socialImage: null,
		meta: {
			buttons: undefined,
			tags: undefined,
			chapterList: undefined,
		},
	});

	// The author association was deleted and re-inserted
	expect(deleteWhere).toBeCalledWith(
		eq(collectionAuthors.collectionSlug, "example-collection"),
	);
	expect(insertAuthorValues).toBeCalledWith([
		{
			collectionSlug: "example-collection",
			authorSlug: "example-author",
		},
	]);
});

test("Deletes a collection record if it no longer exists", async () => {
	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (
			params.path === "/content/example-author/collections/example-collection/"
		) {
			return Promise.resolve({
				data: undefined,
				error: {},
				response: {
					status: 404,
				} as never,
			});
		}
		return Promise.reject();
	}) as never);

	await processor({
		data: {
			author: "example-author",
			collection: "example-collection",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-collection"]>);

	// The collection was deleted from the database
	expect(deleteWhere).toBeCalledWith(
		eq(collectionData.slug, "example-collection"),
	);
});

test("Fails if author profile does not exist", async () => {
	const insertCollectionValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === collectionData) {
			return { values: insertCollectionValues } as never;
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
		if (
			params.path === "/content/example-author/collections/example-collection/"
		) {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: "content/example-author/collections/example-collection/index.md",
						},
					],
				},
				error: undefined,
				response: {} as never,
			});
		}
		return Promise.reject();
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (
			params.path ===
			"/content/example-author/collections/example-collection/index.md"
		) {
			return Promise.resolve({
				data: `---
title: "Example Collection"
description: "A test collection"
coverImg: "./cover.png"
published: "2023-01-01T00:00:00Z"
---
`,
				response: {} as never,
			});
		}
		return Promise.reject();
	});

	vi.mocked(github.getContentsRawStream).mockImplementation((params) => {
		if (
			params.path ===
			"/content/example-author/collections/example-collection/cover.png"
		) {
			const buffer = Buffer.from(mockImage, "base64");
			return Promise.resolve({
				data: Readable.toWeb(Readable.from(buffer)) as never,
				response: {} as never,
			});
		}
		return Promise.reject();
	});

	await expect(
		processor({
			data: {
				author: "example-author",
				collection: "example-collection",
				ref: "main",
			},
		} as unknown as Job<TaskInputs["sync-collection"]>),
	).rejects.toThrow(
		"Author profiles not found for collection example-collection: example-author",
	);
});

test("Handles collection with multiple authors", async () => {
	const insertCollectionValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertAuthorValues = vi.fn();
	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === collectionData) {
			return { values: insertCollectionValues } as never;
		}
		if (table === collectionAuthors) {
			return { values: insertAuthorValues } as never;
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
		if (
			params.path === "/content/example-author/collections/example-collection/"
		) {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: "content/example-author/collections/example-collection/index.md",
						},
					],
				},
				error: undefined,
				response: {} as never,
			});
		}
		return Promise.reject();
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (
			params.path ===
			"/content/example-author/collections/example-collection/index.md"
		) {
			return Promise.resolve({
				data: `---
title: "Example Collection"
description: "A test collection"
authors:
  - co-author
coverImg: "./cover.png"
published: "2023-01-01T00:00:00Z"
---
`,
				response: {} as never,
			});
		}
		return Promise.reject();
	});

	vi.mocked(github.getContentsRawStream).mockImplementation((params) => {
		if (
			params.path ===
			"/content/example-author/collections/example-collection/cover.png"
		) {
			const buffer = Buffer.from(mockImage, "base64");
			return Promise.resolve({
				data: Readable.toWeb(Readable.from(buffer)) as never,
				response: {} as never,
			});
		}
		return Promise.reject();
	});

	await processor({
		data: {
			author: "example-author",
			collection: "example-collection",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-collection"]>);

	// Both authors should be inserted (co-author from frontmatter + example-author as the folder owner)
	expect(insertAuthorValues).toBeCalledWith([
		{
			collectionSlug: "example-collection",
			authorSlug: "co-author",
		},
		{
			collectionSlug: "example-collection",
			authorSlug: "example-author",
		},
	]);
});
