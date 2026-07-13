import processor from "./processor.ts";
import { db, postAttachments } from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";

test("Removes an attachment from S3 when no post_attachments row references it", async () => {
	vi.mocked(s3.list).mockResolvedValue([
		"posts/example-post/en/content.md",
		"posts/example-post/attachments/referenced-sha.pdf",
		"posts/example-post/attachments/orphaned-sha.jpeg",
	]);

	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockResolvedValue([
			{
				attachmentKey: "posts/example-post/attachments/referenced-sha.pdf",
			},
		]),
	} as never);

	await processor({} as never);

	expect(s3.remove).toBeCalledWith(
		"example-bucket",
		"posts/example-post/attachments/orphaned-sha.jpeg",
	);
	expect(s3.remove).toBeCalledTimes(1);
});

test("Leaves an attachment alone when a post_attachments row still references it", async () => {
	vi.mocked(s3.list).mockResolvedValue([
		"posts/example-post/attachments/referenced-sha.pdf",
	]);

	vi.mocked(db.select).mockReturnValue({
		from: vi.fn().mockResolvedValue([
			{
				attachmentKey: "posts/example-post/attachments/referenced-sha.pdf",
			},
		]),
	} as never);

	await processor({} as never);

	expect(s3.remove).not.toBeCalled();
});

test("Does nothing when there are no attachment objects in S3", async () => {
	vi.mocked(s3.list).mockResolvedValue(["posts/example-post/en/content.md"]);

	await processor({} as never);

	expect(db.select).not.toBeCalled();
	expect(s3.remove).not.toBeCalled();
});

test("Queries the full attachment table with no per-post filter", async () => {
	vi.mocked(s3.list).mockResolvedValue([
		"posts/example-post/attachments/orphaned-sha.jpeg",
	]);

	const from = vi.fn().mockResolvedValue([]);
	vi.mocked(db.select).mockReturnValue({ from } as never);

	await processor({} as never);

	expect(from).toBeCalledWith(postAttachments);
	expect(s3.remove).toBeCalledWith(
		"example-bucket",
		"posts/example-post/attachments/orphaned-sha.jpeg",
	);
});
