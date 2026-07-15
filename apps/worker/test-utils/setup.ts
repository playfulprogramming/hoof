import "./server.ts";
import { vi, afterEach, beforeEach } from "vitest";
import "@playfulprogramming/test-fixtures";
import { s3 } from "@playfulprogramming/s3";
import { Readable } from "node:stream";

afterEach(() => {
	vi.clearAllMocks();
	vi.setSystemTime(new Date("2025-05-05"));
});

beforeEach(() => {
	// pipeline() won't resolve until the transform's readable side is drained
	vi.mocked(s3.upload).mockImplementation(async (_bucket, _key, _tag, file) => {
		if (file instanceof Readable) {
			for await (const _chunk of file) {
				// drain
			}
		}
	});
});

vi.mock("@playfulprogramming/bullmq", async () => {
	const tasks = await import("@playfulprogramming/bullmq/src/tasks/index.ts");
	return {
		...tasks,
		flowProducer: { add: vi.fn() },
		createQueue: vi.fn(),
		createJob: vi.fn(),
		// scheduleS3ObjectDeletion calls the real createJob internally via a
		// relative import, which bypasses the createJob mock above - it needs
		// its own override so tests don't hit a real BullMQ queue/Redis.
		scheduleS3ObjectDeletion: vi.fn(),
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
			slug: {},
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
