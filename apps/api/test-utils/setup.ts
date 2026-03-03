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
		createQueue: vi.fn(),
		createJob: vi.fn(),
	};
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
