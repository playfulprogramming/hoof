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
		postData: {
			slug: {},
			locale: {},
			version: {},
		},
		postAuthors: {
			postSlug: {},
			authorSlug: {},
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

vi.mock("@playfulprogramming/github-api", () => {
	return {
		getContents: vi.fn(),
		getContentsRaw: vi.fn(),
		getContentsRawStream: vi.fn(),
		getGistById: vi.fn(),
	};
});
