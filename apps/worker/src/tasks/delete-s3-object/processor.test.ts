import { fakeJob } from "../../../test-utils/fakeJob.ts";
import processor from "./processor.ts";
import { s3 } from "@playfulprogramming/s3";

test("removes the object when it hasn't been modified since scheduling", async () => {
	vi.mocked(s3.unmodifiedSince).mockResolvedValueOnce(true);

	await processor(
		fakeJob({
			bucket: "example-bucket",
			key: "posts/example-post/attachments/notes.pdf",
			lastModified: "2025-05-05T00:00:00.000Z",
		}),
	);

	expect(s3.unmodifiedSince).toBeCalledWith(
		"example-bucket",
		"posts/example-post/attachments/notes.pdf",
		new Date("2025-05-05T00:00:00.000Z"),
	);
	expect(s3.remove).toBeCalledWith(
		"example-bucket",
		"posts/example-post/attachments/notes.pdf",
	);
});

test("skips removal when the object was rewritten since scheduling", async () => {
	vi.mocked(s3.unmodifiedSince).mockResolvedValueOnce(false);

	await processor(
		fakeJob({
			bucket: "example-bucket",
			key: "posts/example-post/attachments/notes.pdf",
			lastModified: "2025-05-05T00:00:00.000Z",
		}),
	);

	expect(s3.remove).not.toBeCalled();
});
