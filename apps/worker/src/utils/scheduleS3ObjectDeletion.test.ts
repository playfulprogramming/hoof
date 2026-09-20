import { scheduleS3ObjectDeletion } from "./scheduleS3ObjectDeletion.ts";
import { enqueueS3ObjectDeletion } from "@playfulprogramming/bullmq";
import { s3 } from "@playfulprogramming/s3";

// This module is mocked wholesale in test-utils/setup.ts for every other
// test file's benefit (they only care that scheduling happened, not how) -
// undo that here so this file exercises the real implementation.
vi.unmock("./scheduleS3ObjectDeletion.ts");

test("skips scheduling and warns when lastModified can't be determined", async () => {
	vi.mocked(s3.getLastModified).mockResolvedValueOnce(undefined);
	const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

	await scheduleS3ObjectDeletion("example-bucket", "posts/example/notes.pdf");

	expect(enqueueS3ObjectDeletion).not.toBeCalled();
	expect(warnSpy).toBeCalledWith(
		expect.stringContaining("posts/example/notes.pdf"),
	);
});

test("passes the object's lastModified through to enqueueS3ObjectDeletion", async () => {
	const lastModified = new Date("2026-01-01T00:00:00.000Z");
	vi.mocked(s3.getLastModified).mockResolvedValueOnce(lastModified);

	await scheduleS3ObjectDeletion("example-bucket", "posts/example/notes.pdf");

	expect(enqueueS3ObjectDeletion).toBeCalledWith(
		"example-bucket",
		"posts/example/notes.pdf",
		lastModified,
	);
});
