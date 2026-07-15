import processor from "./processor.ts";
import type { TaskInputs } from "@playfulprogramming/bullmq";
import type { Job } from "bullmq";
import { s3 } from "@playfulprogramming/s3";

test("removes the object at the given bucket/key from S3", async () => {
	await processor({
		data: {
			bucket: "example-bucket",
			key: "posts/example-post/attachments/notes.pdf",
		},
	} as unknown as Job<TaskInputs["delete-s3-object"]>);

	expect(s3.remove).toBeCalledWith(
		"example-bucket",
		"posts/example-post/attachments/notes.pdf",
	);
});
