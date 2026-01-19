import "./server.ts";
import { vi, afterEach } from "vitest";

afterEach(() => {
	vi.clearAllMocks();
	vi.setSystemTime(new Date("2025-05-05"));
});

vi.mock("@playfulprogramming/common", () => {
	return {
		Tasks: {
			SYNC_AUTHOR: "sync-author",
			SYNC_COLLECTION: "sync-collection",
			SYNC_POST: "sync-post",
			URL_METADATA: "url-metadata",
			POST_IMAGES: "post-images",
		},
		env: {
			ENVIRONMENT: "development",
			SITE_URL: "https://example.com",
			S3_PUBLIC_URL: "https://s3.example.com",
			S3_ENDPOINT: "https://s3.example.com",
			S3_KEY_ID: "test-key-id",
			S3_KEY_SECRET: "test-key-secret",
			S3_BUCKET: "example-bucket",
			POSTGRES_URL: "postgresql://localhost/test",
			REDIS_URL: "redis://localhost:6379",
			GITHUB_REPO_OWNER: "playfulprogramming",
			GITHUB_REPO_NAME: "playfulprogramming",
		},
	};
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
