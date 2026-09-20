import processor from "./processor.ts";
import type { Job } from "bullmq";
import {
	collections,
	collectionAuthors,
	collectionTags,
	db,
	collectionSlugs,
	collectionAttachments,
} from "@playfulprogramming/db";
import { createInstallationClient } from "@playfulprogramming/github-api";
import { and, eq } from "drizzle-orm";

const github = await createInstallationClient(0);

function fakeJob<Data>(data: Data): Job<Data> {
	return { data } as unknown as Job<Data>;
}

const deleteCollectionWhere = db.delete(collections).where;
const insertCollectionSlugValues = db.insert(collectionSlugs).values;
const insertCollectionValues = db.insert(collections).values;
const insertCollectionValuesReturning = db
	.insert(collections)
	.values(expect.anything()).returning;
const insertAuthorValues = db.insert(collectionAuthors).values;
const deleteAuthorsWhere = db.delete(collectionAuthors).where;
const insertTagsValues = db.insert(collectionTags).values;
const deleteTagsWhere = db.delete(collectionTags).where;
const insertAttachmentsValues = db.insert(collectionAttachments).values;

vi.mock(import("../../sync/attachments.ts"), async (importOriginal) => {
	const original = await importOriginal();
	return {
		syncAttachments: vi.fn(original.syncAttachmentsFake),
		resolveAttachment: vi.fn(original.resolveAttachment),
	};
});

test("Creates an example collection successfully", async () => {
	const collectionId = "00000000-0000-0000-0000-000000000000";
	vi.mocked(insertCollectionValuesReturning).mockResolvedValue([
		{ id: collectionId },
	]);

	const folder = {
		entries: [
			{
				name: "cover.png",
				path: "content/example-author/collections/example-collection/cover.png",
				type: "file",
				sha: "cover-sha",
			},
			{
				name: "index.md",
				path: "content/example-author/collections/example-collection/index.md",
				type: "file",
				sha: "index-sha",
			},
		],
	};

	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (
			params.path === "/content/example-author/collections/example-collection/"
		) {
			return Promise.resolve({
				data: folder,
				status: 200,
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
tags:
  - javascript
  - tutorial
---
`,
				status: 200,
			});
		}
		return Promise.reject();
	});

	await processor(
		fakeJob({
			author: "example-author",
			collection: "example-collection",
			ref: "main",
			installation: { id: 0 },
		}),
	);

	// The collection was inserted into the database
	expect(insertCollectionSlugValues).toHaveBeenCalledWith({
		slug: "example-collection",
	});
	expect(insertCollectionValues).toHaveBeenCalledWith({
		slug: "example-collection",
		locale: "en",
		branch: "main",
		title: "Example Collection",
		description: "A test collection",
		coverImage: "collections/example-collection/attachments/cover-sha.jpeg",
		socialImage: null,
		meta: {
			buttons: undefined,
			tags: ["javascript", "tutorial"],
			chapterList: undefined,
		},
	});

	// The author association was deleted and re-inserted
	expect(deleteAuthorsWhere).toHaveBeenCalledWith(
		eq(collectionAuthors.collectionId, collectionId),
	);
	expect(insertAuthorValues).toHaveBeenCalledWith([
		{
			collectionId,
			authorSlug: "example-author",
		},
	]);

	// The tag association was deleted and re-inserted
	expect(deleteTagsWhere).toHaveBeenCalledWith(
		eq(collectionTags.collectionId, collectionId),
	);
	expect(insertTagsValues).toHaveBeenCalledWith([
		{
			collectionId,
			tag: "javascript",
		},
		{
			collectionId,
			tag: "tutorial",
		},
	]);

	// The cover image & index attachments were inserted
	expect(insertAttachmentsValues).toHaveBeenCalledWith([
		{
			collectionId,
			attachmentKey:
				"collections/example-collection/attachments/cover-sha.jpeg",
			attachmentName: "cover.png",
		},
		{
			collectionId,
			attachmentKey: "collections/example-collection/attachments/index-sha.md",
			attachmentName: "index.md",
		},
	]);
});

test("Deletes a collection record if it no longer exists", async () => {
	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (
			params.path === "/content/example-author/collections/example-collection/"
		) {
			return Promise.resolve({
				data: undefined,
				status: 404,
			});
		}
		return Promise.reject();
	}) as never);

	await processor(
		fakeJob({
			author: "example-author",
			collection: "example-collection",
			ref: "main",
			installation: { id: 0 },
		}),
	);

	// The collection was deleted from the database
	expect(deleteCollectionWhere).toHaveBeenCalledWith(
		and(
			eq(collections.slug, "example-collection"),
			eq(collections.branch, "main"),
		),
	);
});

test("Fails if author profile does not exist", async () => {
	const collectionId = "00000000-0000-0000-0000-000000000000";
	vi.mocked(insertCollectionValuesReturning).mockResolvedValue([
		{ id: collectionId },
	]);

	vi.mocked(insertAuthorValues).mockImplementationOnce(() => {
		throw new Error("Failed relation constraint");
	});

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
				status: 200,
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
				status: 200,
			});
		}
		return Promise.reject();
	});

	await expect(
		processor(
			fakeJob({
				author: "example-author",
				collection: "example-collection",
				ref: "main",
				installation: { id: 0 },
			}),
		),
	).rejects.toThrow("Failed relation constraint");
});

test("Handles collection with multiple authors", async () => {
	const collectionId = "00000000-0000-0000-0000-000000000000";
	vi.mocked(insertCollectionValuesReturning).mockResolvedValue([
		{ id: collectionId },
	]);

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
				status: 200,
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
				status: 200,
			});
		}
		return Promise.reject();
	});

	await processor(
		fakeJob({
			author: "example-author",
			collection: "example-collection",
			ref: "main",
			installation: { id: 0 },
		}),
	);

	// Both authors should be inserted (co-author from frontmatter + example-author as the folder owner)
	expect(insertAuthorValues).toHaveBeenCalledWith([
		{
			collectionId,
			authorSlug: "co-author",
		},
		{
			collectionId,
			authorSlug: "example-author",
		},
	]);
});

test("Replaces tags when synced again with a different tag set", async () => {
	const collectionId = "00000000-0000-0000-0000-000000000000";
	vi.mocked(insertCollectionValuesReturning).mockResolvedValue([
		{ id: collectionId },
	]);

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
				status: 200,
			});
		}
		return Promise.reject();
	}) as never);

	// First sync: original tag set
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
tags:
  - javascript
  - tutorial
---
`,
				status: 200,
			});
		}
		return Promise.reject();
	});

	await processor(
		fakeJob({
			author: "example-author",
			collection: "example-collection",
			ref: "main",
			installation: { id: 0 },
		}),
	);

	expect(insertTagsValues).toHaveBeenCalledWith([
		{
			collectionId,
			tag: "javascript",
		},
		{
			collectionId,
			tag: "tutorial",
		},
	]);

	vi.mocked(deleteTagsWhere).mockClear();
	vi.mocked(insertTagsValues).mockClear();

	// Second sync: a different tag set
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
tags:
  - rust
---
`,
				status: 200,
			});
		}
		return Promise.reject();
	});

	await processor(
		fakeJob({
			author: "example-author",
			collection: "example-collection",
			ref: "main",
			installation: { id: 0 },
		}),
	);

	// Old tags were deleted and only the new tag set remains
	expect(deleteTagsWhere).toHaveBeenCalledWith(
		eq(collectionTags.collectionId, collectionId),
	);
	expect(insertTagsValues).toHaveBeenCalledWith([
		{
			collectionId,
			tag: "rust",
		},
	]);
	expect(insertTagsValues).not.toHaveBeenCalledWith(
		expect.arrayContaining([expect.objectContaining({ tag: "javascript" })]),
	);
	expect(insertTagsValues).not.toHaveBeenCalledWith(
		expect.arrayContaining([expect.objectContaining({ tag: "tutorial" })]),
	);
});

test("Unions tags across all locales", async () => {
	const collectionEnId = "00000000-0000-0000-0000-000000000000";
	const collectionEsId = "11111111-1111-1111-1111-111111111111";
	vi.mocked(insertCollectionValuesReturning).mockResolvedValueOnce([
		{ id: collectionEnId },
	]);
	vi.mocked(insertCollectionValuesReturning).mockResolvedValueOnce([
		{ id: collectionEsId },
	]);

	// Return folder listing with both index.md and index.es.md
	vi.mocked(github.getContents).mockImplementation(((params: {
		path: string;
	}) => {
		if (
			params.path ===
			"/content/example-author/collections/multilang-tags-collection/"
		) {
			return Promise.resolve({
				data: {
					entries: [
						{
							name: "index.md",
							path: "content/example-author/collections/multilang-tags-collection/index.md",
						},
						{
							name: "index.es.md",
							path: "content/example-author/collections/multilang-tags-collection/index.es.md",
						},
					],
				},
				status: 200,
			});
		}
		return Promise.reject();
	}) as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (
			params.path ===
			"/content/example-author/collections/multilang-tags-collection/index.md"
		) {
			return Promise.resolve({
				data: `---
title: "English Collection"
description: "A test collection"
coverImg: "./cover.png"
published: "2023-01-01T00:00:00Z"
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
			"/content/example-author/collections/multilang-tags-collection/index.es.md"
		) {
			return Promise.resolve({
				data: `---
title: "Colección en Español"
description: "A test collection"
coverImg: "./cover.png"
published: "2023-01-01T00:00:00Z"
tags:
  - espanol
---
`,
				status: 200,
			});
		}
		return Promise.reject();
	});

	await processor(
		fakeJob({
			author: "example-author",
			collection: "multilang-tags-collection",
			ref: "main",
			installation: { id: 0 },
		}),
	);

	// Assert: tags from both locales are unioned and deduped
	expect(insertTagsValues).toHaveBeenCalledTimes(2);
	expect(insertTagsValues).toHaveBeenCalledWith([
		{
			collectionId: collectionEnId,
			tag: "javascript",
		},
		{
			collectionId: collectionEnId,
			tag: "tutorial",
		},
		{
			collectionId: collectionEnId,
			tag: "espanol",
		},
	]);
	expect(insertTagsValues).toHaveBeenCalledWith([
		{
			collectionId: collectionEsId,
			tag: "javascript",
		},
		{
			collectionId: collectionEsId,
			tag: "tutorial",
		},
		{
			collectionId: collectionEsId,
			tag: "espanol",
		},
	]);

	// Assert: the tags delete ran once per locale
	expect(deleteTagsWhere).toHaveBeenCalledTimes(2);
	expect(deleteTagsWhere).toHaveBeenCalledWith(
		eq(collectionTags.collectionId, collectionEnId),
	);
	expect(deleteTagsWhere).toHaveBeenCalledWith(
		eq(collectionTags.collectionId, collectionEsId),
	);
});
