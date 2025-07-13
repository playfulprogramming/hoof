import { vi, afterEach } from "vitest";
import type { EnvType } from "@playfulprogramming/common";

afterEach(() => {
	vi.clearAllMocks();
	vi.setSystemTime(new Date("2025-05-05"));
});

vi.mock("bullmq", () => {
	const Queue = vi.fn();
	Queue.prototype.add = vi.fn();
	return { Queue };
});

vi.mock("@playfulprogramming/redis", () => {
	return { redis: undefined };
});

vi.mock("@playfulprogramming/db", () => {
	return {
		db: {
			query: {
				postImages: {
					findFirst: vi.fn(),
				},
				urlMetadata: {
					findFirst: vi.fn(),
				},
			},
		},
	};
});

vi.mock("@playfulprogramming/common", async (importOriginal) => {
	return {
		...(await importOriginal()),
		env: {
			PORT: 3000,
			ENVIRONMENT: "production",
			SITE_URL: "https://site_url.test",
			S3_PUBLIC_URL: "https://s3_public_url.test",
			S3_ENDPOINT: "https://s3_endpoint.test",
			S3_KEY_ID: "s3_key_id",
			S3_KEY_SECRET: "s3_key_secret",
			S3_BUCKET: "s3_bucket",
			POSTGRES_URL: "postgresql://postgres_url.test",
			REDIS_URL: "redis://redis_url.test",
			REDIS_PASSWORD: "redis_password",
		} satisfies EnvType,
	};
});
