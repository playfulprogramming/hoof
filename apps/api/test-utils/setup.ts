import { vi, beforeEach } from "vitest";
import { createDbMock } from "@playfulprogramming/test-fixtures";

beforeEach(() => {
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

vi.mock("@playfulprogramming/db", () => createDbMock());
