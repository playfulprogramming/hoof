import { scheduleS3ObjectDeletion } from "./delete-s3-object.ts";
import { createJob } from "../queues.ts";
import { s3 } from "@playfulprogramming/s3";

vi.mock("../queues.ts", () => ({
	createJob: vi.fn(),
}));

vi.mock("@playfulprogramming/s3", () => ({
	s3: {
		getLastModified: vi.fn(),
	},
}));

afterEach(() => {
	vi.clearAllMocks();
});

function jobIdFromCall(callIndex: number): string {
	return vi.mocked(createJob).mock.calls[callIndex][1] as string;
}

test("reuses the same job id when lastModified is unchanged across calls", async () => {
	vi.mocked(s3.getLastModified).mockResolvedValue(
		new Date("2026-01-01T00:00:00.000Z"),
	);

	await scheduleS3ObjectDeletion("example-bucket", "posts/example/notes.pdf");
	await scheduleS3ObjectDeletion("example-bucket", "posts/example/notes.pdf");

	expect(jobIdFromCall(0)).toEqual(jobIdFromCall(1));
});

test("uses a different job id when lastModified changes between calls", async () => {
	vi.mocked(s3.getLastModified).mockResolvedValueOnce(
		new Date("2026-01-01T00:00:00.000Z"),
	);
	await scheduleS3ObjectDeletion("example-bucket", "posts/example/notes.pdf");

	vi.mocked(s3.getLastModified).mockResolvedValueOnce(
		new Date("2026-01-02T00:00:00.000Z"),
	);
	await scheduleS3ObjectDeletion("example-bucket", "posts/example/notes.pdf");

	expect(jobIdFromCall(0)).not.toEqual(jobIdFromCall(1));
});

test("does not schedule a deletion when lastModified can't be determined", async () => {
	vi.mocked(s3.getLastModified).mockResolvedValue(undefined);

	await scheduleS3ObjectDeletion("example-bucket", "posts/example/notes.pdf");

	expect(createJob).not.toBeCalled();
});
