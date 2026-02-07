import { vi, afterEach } from "vitest";
import "@playfulprogramming/test-fixtures";

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
