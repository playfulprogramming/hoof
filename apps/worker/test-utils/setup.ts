import "./server.ts";
import { vi, afterEach, beforeEach } from "vitest";
import { createDbMock } from "@playfulprogramming/test-fixtures";
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
		// enqueueS3ObjectDeletion calls the real createJob internally via a
		// relative import, which bypasses the createJob mock above - it needs
		// its own override so tests don't hit a real BullMQ queue/Redis.
		enqueueS3ObjectDeletion: vi.fn(),
	};
});

vi.mock("../src/utils/scheduleS3ObjectDeletion.ts", () => ({
	scheduleS3ObjectDeletion: vi.fn(),
}));

vi.mock("@playfulprogramming/s3", () => {
	return {
		s3: {
			ensureBucket: vi.fn(() => "example-bucket"),
			upload: vi.fn(),
			remove: vi.fn(),
			list: vi.fn(() => []),
			getLastModified: vi.fn(),
			unmodifiedSince: vi.fn(() => true),
		},
	};
});

vi.mock("@playfulprogramming/db", () => createDbMock());

vi.mock("@playfulprogramming/github-api", async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...(actual as object),
		createAppClient: vi.fn().mockReturnValue({
			getGistById: vi.fn(),
		}),
		createInstallationClient: vi.fn().mockResolvedValue({
			getContents: vi.fn(),
			getContentsRaw: vi.fn(),
			getContentsRawStream: vi.fn(),
			getGistById: vi.fn(),
			getAuthorGitHubStats: vi.fn().mockResolvedValue(undefined),
		}),
	};
});
