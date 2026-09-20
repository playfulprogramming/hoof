import { enqueueS3ObjectDeletion } from "./delete-s3-object.ts";
import { createJob } from "../queues.ts";

vi.mock("../queues.ts", () => ({
	createJob: vi.fn(),
}));

afterEach(() => {
	vi.clearAllMocks();
});

function jobIdFromCall(callIndex: number): string {
	return vi.mocked(createJob).mock.calls[callIndex][1] as string;
}

test("reuses the same job id when lastModified is unchanged across calls", async () => {
	const lastModified = new Date("2026-01-01T00:00:00.000Z");

	await enqueueS3ObjectDeletion(
		"example-bucket",
		"posts/example/notes.pdf",
		lastModified,
	);
	await enqueueS3ObjectDeletion(
		"example-bucket",
		"posts/example/notes.pdf",
		lastModified,
	);

	expect(jobIdFromCall(0)).toEqual(jobIdFromCall(1));
});

test("uses a different job id when lastModified changes between calls", async () => {
	await enqueueS3ObjectDeletion(
		"example-bucket",
		"posts/example/notes.pdf",
		new Date("2026-01-01T00:00:00.000Z"),
	);
	await enqueueS3ObjectDeletion(
		"example-bucket",
		"posts/example/notes.pdf",
		new Date("2026-01-02T00:00:00.000Z"),
	);

	expect(jobIdFromCall(0)).not.toEqual(jobIdFromCall(1));
});
