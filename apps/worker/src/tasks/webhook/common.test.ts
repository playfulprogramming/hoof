import { flowProducer } from "@playfulprogramming/bullmq";
import { enqueueSyncJobs } from "./common.ts";

test("Given enqueueSyncJobs is called with an author, the expected job is submitted", async () => {
	await enqueueSyncJobs({
		files: ["content/example-author/index.md"],
		ref: "example-ref",
		branch: "example-branch",
		installation: { id: 0 },
	});

	expect(vi.mocked(flowProducer.add).mock.calls).toMatchFileSnapshot(
		"./__snapshots__/enqueueSyncJobs-single-author.ts.snap",
	);
});

test("Given enqueueSyncJobs is called with multiple posts and authors, the expected job is submitted", async () => {
	await enqueueSyncJobs({
		files: [
			"content/author/index.md",
			"content/author/posts/post/index.md",
			"content/someoneelse/collections/collection/posts/post/index.md",
			"README.md",
		],
		ref: "example-ref",
		branch: "example-branch",
		installation: { id: 0 },
	});

	expect(vi.mocked(flowProducer.add).mock.calls).toMatchFileSnapshot(
		"./__snapshots__/enqueueSyncJobs-with-multiple-posts.ts.snap",
	);
});

test("Given enqueueSyncJobs is called with only unrelated files, no job is submitted", async () => {
	await enqueueSyncJobs({
		files: ["README.md", ".github/ci.yml"],
		ref: "example-ref",
		branch: "example-branch",
		installation: { id: 0 },
	});

	expect(flowProducer.add).not.toHaveBeenCalled();
});
