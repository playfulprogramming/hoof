import processor from "./processor.ts";
import type { TaskInputs } from "@playfulprogramming/bullmq";
import type { Job } from "bullmq";
import { s3 } from "@playfulprogramming/s3";

test("removes the object when no lastModified was captured at scheduling time", async () => {
	await processor({
		data: {
			bucket: "example-bucket",
			key: "posts/example-post/attachments/notes.pdf",
		},
	} as unknown as Job<TaskInputs["delete-s3-object"]>);

	expect(s3.unmodifiedSince).not.toBeCalled();
	expect(s3.remove).toBeCalledWith(
		"example-bucket",
		"posts/example-post/attachments/notes.pdf",
	);
});

test("removes the object when it hasn't been modified since scheduling", async () => {
	vi.mocked(s3.unmodifiedSince).mockResolvedValueOnce(true);

	await processor({
		data: {
			bucket: "example-bucket",
			key: "posts/example-post/attachments/notes.pdf",
			lastModified: "2025-05-05T00:00:00.000Z",
		},
	} as unknown as Job<TaskInputs["delete-s3-object"]>);

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

	await processor({
		data: {
			bucket: "example-bucket",
			key: "posts/example-post/attachments/notes.pdf",
			lastModified: "2025-05-05T00:00:00.000Z",
		},
	} as unknown as Job<TaskInputs["delete-s3-object"]>);

	expect(s3.remove).not.toBeCalled();
});
