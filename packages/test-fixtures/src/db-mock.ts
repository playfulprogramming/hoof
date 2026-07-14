import { vi } from "vitest";

export function createDbMock() {
	const insertMap = new Map<unknown, unknown>();
	const insertMockResponse = () => {
		const onConflictDoUpdate = vi.fn();
		return { values: vi.fn(() => ({ onConflictDoUpdate })) };
	};

	const deleteMap = new Map<unknown, unknown>();
	const deleteMockResponse = () => {
		const returning = vi.fn();
		return { where: vi.fn(() => ({ returning })) };
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
		select: vi.fn(),
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
		posts: {
			slug: {},
			collectionSlug: {},
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
		postData: {
			slug: {},
			locale: {},
			version: {},
			title: {},
			bannerImage: {},
			wordCount: {},
			publishedAt: {},
			noindex: {},
		},
		postAuthors: {
			postSlug: {},
			authorSlug: {},
		},
		postTags: {
			postSlug: {},
			tag: {},
		},
		postAttachments: {
			postSlug: {},
			attachmentName: {},
		},
		collectionChapters: {
			postSlug: {},
			locale: {},
		},
		urlMetadata: {},
		urlMetadataPost: {},
		urlMetadataGist: {},
		urlMetadataGistFile: {},
		db,
	};
}
