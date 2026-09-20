import processor from "./processor.ts";
import { db, attachments } from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import { lt } from "drizzle-orm";
import type * as DrizzleOrm from "drizzle-orm";

vi.mock("drizzle-orm", async (importOriginal) => {
	const actual = await importOriginal<typeof DrizzleOrm>();
	return { ...actual, lt: vi.fn(actual.lt) };
});

const NOW = new Date("2025-05-05T12:00:00Z");

const deleteAttachmentReturning = db
	.delete(attachments)
	.where(expect.anything()).returning;
const insertAttachmentValues = db.insert(attachments).values;
const insertAttachmentOnConflictDoUpdate = db
	.insert(attachments)
	.values(expect.anything()).onConflictDoUpdate;

test("Removes an attachment returned by the delete query from S3", async () => {
	vi.setSystemTime(NOW);

	vi.mocked(deleteAttachmentReturning)
		.mockResolvedValueOnce([
			{
				attachmentKey: "posts/example-post/attachments/orphaned-sha.jpeg",
				sha: "orphaned-sha",
				width: 100,
				height: 100,
			},
		])
		.mockResolvedValueOnce([]);

	await processor({} as never);

	expect(s3.remove).toHaveBeenCalledWith(
		"example-bucket",
		"posts/example-post/attachments/orphaned-sha.jpeg",
	);
	expect(s3.remove).toHaveBeenCalledTimes(1);
});

test("Uses a one-hour-old cutoff for the lastModified staleness check", async () => {
	vi.setSystemTime(NOW);

	vi.mocked(deleteAttachmentReturning).mockResolvedValueOnce([]);

	await processor({} as never);

	expect(lt).toHaveBeenCalledWith(
		attachments.lastModified,
		new Date(NOW.getTime() - 60 * 60 * 1000),
	);
});

test("Does nothing when the delete query returns no rows", async () => {
	vi.setSystemTime(NOW);

	vi.mocked(deleteAttachmentReturning).mockResolvedValueOnce([]);

	await processor({} as never);

	expect(s3.remove).not.toHaveBeenCalled();
});

test("Keeps deleting and removing until the delete query returns no more rows", async () => {
	vi.setSystemTime(NOW);

	vi.mocked(deleteAttachmentReturning)
		.mockResolvedValueOnce([
			{
				attachmentKey: "posts/example-post/attachments/first.jpeg",
				sha: "first",
				width: 1,
				height: 1,
			},
		])
		.mockResolvedValueOnce([
			{
				attachmentKey: "posts/example-post/attachments/second.jpeg",
				sha: "second",
				width: 1,
				height: 1,
			},
		])
		.mockResolvedValueOnce([]);

	await processor({} as never);

	expect(s3.remove).toHaveBeenNthCalledWith(
		1,
		"example-bucket",
		"posts/example-post/attachments/first.jpeg",
	);
	expect(s3.remove).toHaveBeenNthCalledWith(
		2,
		"example-bucket",
		"posts/example-post/attachments/second.jpeg",
	);
	expect(s3.remove).toHaveBeenCalledTimes(2);
});

test("Re-inserts the row and fails the job when S3 removal rejects, rather than leaking the object untracked", async () => {
	vi.setSystemTime(NOW);

	const orphan = {
		attachmentKey: "posts/example-post/attachments/orphaned-sha.jpeg",
		sha: "orphaned-sha",
		width: 100,
		height: 100,
	};
	vi.mocked(deleteAttachmentReturning).mockResolvedValueOnce([orphan]);

	const s3Error = new Error("S3 removal failed");
	vi.mocked(s3.remove).mockRejectedValue(s3Error);

	await expect(processor({} as never)).rejects.toThrow(s3Error);

	expect(insertAttachmentValues).toHaveBeenCalledWith({
		...orphan,
		lastModified: expect.any(Date),
	});
	expect(insertAttachmentOnConflictDoUpdate).toHaveBeenCalledWith({
		target: attachments.attachmentKey,
		set: { lastModified: expect.any(Date) },
	});
});
