import "./server.ts";
import { vi, afterEach } from "vitest";
import "@playfulprogramming/test-fixtures";

afterEach(() => {
	vi.clearAllMocks();
	vi.setSystemTime(new Date("2025-05-05"));
});

vi.mock("@playfulprogramming/s3", () => {
	return {
		s3: {
			ensureBucket: vi.fn(() => "example-bucket"),
			upload: vi.fn(),
		},
	};
});

vi.mock("@playfulprogramming/db", () => {
	const db = {
		insert: vi.fn(),
		delete: vi.fn(),
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
		db,
	};
});

vi.mock("@playfulprogramming/github-api", () => {
	return {
		getContents: vi.fn(),
		getContentsRaw: vi.fn(),
		getContentsRawStream: vi.fn(),
	};
});
