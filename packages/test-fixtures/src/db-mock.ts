import { vi } from "vitest";

const tableName = Symbol();

export function createDbMock() {
	const insertMap = new Map<unknown, unknown>();
	const insertMockResponse = (name: string) => {
		const returning = vi.fn().mockName(`insert(${name}).returning`);
		const onConflictDoNothing = vi
			.fn(() => ({ returning }))
			.mockName(`insert(${name}).onConflictDoNothing`);
		const onConflictDoUpdate = vi
			.fn(() => ({ returning }))
			.mockName(`insert(${name}).onConflictDoUpdate`);
		return {
			values: vi
				.fn(() => ({
					returning,
					onConflictDoNothing,
					onConflictDoUpdate,
				}))
				.mockName(`insert(${name}).values`),
		};
	};

	const deleteMap = new Map<unknown, unknown>();
	const deleteMockResponse = (name: string) => {
		const returning = vi.fn().mockName(`delete(${name}).returning`);
		return {
			where: vi.fn(() => ({ returning })).mockName(`delete(${name}).where`),
		};
	};

	const selectMap = new Map<unknown, unknown>();
	const selectMockResponse = (name: string) => {
		const limit = vi.fn().mockName(`select().from(${name}).limit`);
		const where = vi
			.fn(() => ({ limit }))
			.mockName(`select().from(${name}).where`);
		const innerJoin = vi
			.fn(() => ({ where, innerJoin }))
			.mockName(`select().from(${name}).innerJoin`);
		return { innerJoin, where, limit };
	};

	const db = {
		insert: vi
			.fn((arg) => {
				return (
					insertMap.get(arg) ??
					insertMap.set(arg, insertMockResponse(arg[tableName])).get(arg)
				);
			})
			.mockName("insert"),
		delete: vi
			.fn((arg) => {
				return (
					deleteMap.get(arg) ??
					deleteMap.set(arg, deleteMockResponse(arg[tableName])).get(arg)
				);
			})
			.mockName("delete"),
		select: vi
			.fn(() => ({
				from: vi
					.fn((arg) => {
						return (
							selectMap.get(arg) ??
							selectMap.set(arg, selectMockResponse(arg[tableName])).get(arg)
						);
					})
					.mockName("select().from"),
			}))
			.mockName("select"),
		transaction: vi
			.fn((cb: (tx: unknown) => unknown) => cb(db))
			.mockName("transaction"),
		query: {
			postImages: {
				findFirst: vi.fn(),
			},
			urlMetadata: {
				findFirst: vi.fn(),
			},
			collections: {
				findMany: vi.fn(),
			},
			posts: {
				findFirst: vi.fn(),
				findMany: vi.fn(),
			},
			authors: {
				findMany: vi.fn(),
			},
			githubInstallations: {
				findFirst: vi.fn(),
			},
		},
	};

	const tables = {
		authorSlugs: {
			slug: Symbol("authorSlugs.slug"),
		},
		authors: {
			id: Symbol("authors.id"),
			slug: Symbol("authors.slug"),
			branch: Symbol("authors.branch"),
			name: {},
			description: {},
			profileImage: {},
		},
		authorAchievements: {
			authorSlug: {},
			achievementId: {},
		},
		authorRoles: {
			authorSlug: {},
			role: {},
		},
		postGroups: {
			id: {},
		},
		posts: {
			id: {},
			slug: {},
			locale: {},
			branch: {},
			collectionSlug: {},
			collectionOrder: {},
			groupId: {},
			versionName: {},
			versionOrder: {},
			title: {},
			description: {},
			wordCount: {},
			socialImage: {},
			bannerImage: {},
			originalLink: {},
			noindex: {},
			editedAt: {},
			publishedAt: {},
			meta: {},
		},
		collectionSlugs: {
			slug: Symbol("collectionSlugs.slug"),
		},
		collections: {
			id: Symbol("collections.id"),
			slug: Symbol("collections.slug"),
			locale: Symbol("collections.locale"),
			branch: Symbol("collections.branch"),
		},
		collectionAttachments: {
			collectionId: Symbol("collectionAttachments.collectionId"),
			attachmentKey: Symbol("collectionAttachments.attachmentKey"),
			attachmentName: Symbol("collectionAttachments.attachmentName"),
		},
		collectionAuthors: {
			collectionId: Symbol("collectionAuthors.collectionId"),
			authorSlug: {},
		},
		collectionTags: {
			collectionId: Symbol("collectionTags.collectionId"),
			tag: {},
		},
		githubInstallations: {
			id: {},
			installationId: {},
		},
		postAuthors: {
			postId: {},
			authorSlug: {},
		},
		postTags: {
			postId: {},
			tag: {},
		},
		postAttachments: {
			postId: {},
			attachmentKey: {},
			attachmentName: {},
		},
		attachments: {
			attachmentKey: {},
			sha: {},
			width: {},
			height: {},
			lastModified: {},
		},
		urlMetadata: {},
		urlMetadataPost: {},
		urlMetadataGist: {},
		urlMetadataGistFile: {},
		db,
	};

	for (const [key, value] of Object.entries(tables)) {
		(value as Record<string, unknown>)[tableName as never] = key;
	}

	return tables;
}
