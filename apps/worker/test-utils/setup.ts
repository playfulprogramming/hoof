import "./server.ts";
import { vi, afterEach } from "vitest";
import "@playfulprogramming/test-fixtures";

afterEach(() => {
	vi.clearAllMocks();
	vi.setSystemTime(new Date("2025-05-05"));
});

vi.mock("@playfulprogramming/bullmq", async () => {
	const tasks = await import("@playfulprogramming/bullmq/src/tasks/index.ts");
	return {
		...tasks,
		flowProducer: { add: vi.fn() },
		createQueue: vi.fn(),
		createJob: vi.fn(),
	};
});

vi.mock("@playfulprogramming/s3", () => {
	return {
		s3: {
			ensureBucket: vi.fn(() => "example-bucket"),
			upload: vi.fn(),
			remove: vi.fn(),
		},
	};
});

vi.mock("@playfulprogramming/db", () => {
	const insertMap = new Map<unknown, unknown>();
	const insertMockResponse = () => {
		const returning = vi.fn();
		const onConflictDoUpdate = vi.fn(() => ({ returning }));
		return { values: vi.fn(() => ({ returning, onConflictDoUpdate })) };
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
		return { innerJoin, where };
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
	};

	return {
		profiles: {
			slug: {},
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
			id: {},
			slug: {},
			locale: {},
			branch: {},
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
		},
		attachments: {
			attachmentKey: {},
			attachmentName: {},
			sha: {},
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
});

vi.mock("@playfulprogramming/github-api", async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...(actual as object),
		getContents: vi.fn(),
		getContentsRaw: vi.fn(),
		getContentsRawStream: vi.fn(),
		getGistById: vi.fn(),
		getAuthorGitHubStats: vi.fn().mockResolvedValue(undefined),
	};
});
