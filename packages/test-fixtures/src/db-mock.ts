import { vi } from "vitest";

export function createDbMock() {
	const insertMap = new Map<unknown, unknown>();
	const insertMockResponse = () => {
		const returning = vi.fn();
		const onConflictDoNothing = vi.fn(() => ({ returning }));
		const onConflictDoUpdate = vi.fn(() => ({ returning }));
		return {
			values: vi.fn(() => ({
				returning,
				onConflictDoNothing,
				onConflictDoUpdate,
			})),
		};
	};

	const deleteMap = new Map<unknown, unknown>();
	const deleteMockResponse = () => {
		const returning = vi.fn();
		return { where: vi.fn(() => ({ returning })) };
	};

	const selectMap = new Map<unknown, unknown>();
	const selectMockResponse = () => {
		const limit = vi.fn();
		const where = vi.fn(() => ({ limit }));
		const innerJoin = vi.fn(() => ({ where, innerJoin }));
		return { innerJoin, where, limit };
	};

	const db = {
		insert: vi.fn((arg) => {
			return (
				insertMap.get(arg) ?? insertMap.set(arg, insertMockResponse()).get(arg)
			);
		}),
		delete: vi.fn((arg) => {
			return (
				deleteMap.get(arg) ?? deleteMap.set(arg, deleteMockResponse()).get(arg)
			);
		}),
		select: vi.fn(() => ({
			from: vi.fn((arg) => {
				return (
					selectMap.get(arg) ??
					selectMap.set(arg, selectMockResponse()).get(arg)
				);
			}),
		})),
		transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(db)),
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
			profiles: {
				findMany: vi.fn(),
			},
		},
	};

	return {
		profiles: {
			slug: {},
			name: {},
			description: {},
			profileImage: {},
		},
		profileAchievements: {
			profileSlug: {},
			achievementId: {},
		},
		authorRoles: {
			profileSlug: {},
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
		collections: {
			slug: {},
		},
		collectionData: {
			slug: {},
			locale: {},
		},
		collectionAuthors: {
			collectionSlug: {},
			authorSlug: {},
		},
		collectionTags: {
			collectionSlug: {},
			tag: {},
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
}
