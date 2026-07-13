import processor from "./processor.ts";
import { db, postAttachments } from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";

const NOW = new Date("2025-05-05T12:00:00Z");
const ONE_HOUR_MS = 60 * 60 * 1000;
const OUTSIDE_GRACE_PERIOD = new Date(NOW.getTime() - ONE_HOUR_MS - 1000);
const INSIDE_GRACE_PERIOD = new Date(NOW.getTime() - 30 * 60 * 1000);

test("Removes an attachment from S3 when no post_attachments row references it", async () => {
	vi.setSystemTime(NOW);

	vi.mocked(s3.list).mockResolvedValue([
		{
			key: "posts/example-post/en/content.md",
			lastModified: OUTSIDE_GRACE_PERIOD,
		},
		{
			key: "posts/example-post/attachments/referenced-sha.pdf",
			lastModified: OUTSIDE_GRACE_PERIOD,
		},
		{
			key: "posts/example-post/attachments/orphaned-sha.jpeg",
			lastModified: OUTSIDE_GRACE_PERIOD,
		},
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
	vi.setSystemTime(NOW);

	vi.mocked(s3.list).mockResolvedValue([
		{
			key: "posts/example-post/attachments/referenced-sha.pdf",
			lastModified: OUTSIDE_GRACE_PERIOD,
		},
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
	vi.setSystemTime(NOW);

	vi.mocked(s3.list).mockResolvedValue([
		{
			key: "posts/example-post/en/content.md",
			lastModified: OUTSIDE_GRACE_PERIOD,
		},
	]);

	await processor({} as never);

	expect(db.select).not.toBeCalled();
	expect(s3.remove).not.toBeCalled();
});

test("Queries the full attachment table with no per-post filter", async () => {
	vi.setSystemTime(NOW);

	vi.mocked(s3.list).mockResolvedValue([
		{
			key: "posts/example-post/attachments/orphaned-sha.jpeg",
			lastModified: OUTSIDE_GRACE_PERIOD,
		},
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

test("Leaves an unreferenced attachment alone when it's within the grace period", async () => {
	vi.setSystemTime(NOW);

	vi.mocked(s3.list).mockResolvedValue([
		{
			key: "posts/example-post/attachments/fresh-sha.jpeg",
			lastModified: INSIDE_GRACE_PERIOD,
		},
	]);

	await processor({} as never);

	// The grace period filters it out before the post_attachments query even runs
	expect(db.select).not.toBeCalled();
	expect(s3.remove).not.toBeCalled();
});
