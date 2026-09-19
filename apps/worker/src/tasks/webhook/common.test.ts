import { flowProducer } from "@playfulprogramming/bullmq";
import { enqueueSyncJobs } from "./common.ts";

test("Given enqueueSyncJobs is called with a post, the expected job is submitted", async () => {
	await enqueueSyncJobs({
		files: ["content/author/example/index.md"],
		ref: "example-ref",
		branch: "example-branch",
		installation: { id: 0 },
	});

	expect(flowProducer.add).toHaveBeenCalledWith({});
});
