import { env } from "@playfulprogramming/common";
import { Tasks } from "@playfulprogramming/bullmq";
import { db, attachments, postAttachments } from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import { and, eq, lt, notExists } from "drizzle-orm";
import { createProcessor } from "../../createProcessor.ts";

const GRACE_PERIOD_MS = 60 * 60 * 1000;

export default createProcessor(Tasks.CLEANUP_ATTACHMENTS, async () => {
	const bucket = await s3.ensureBucket(env.S3_BUCKET);
	const staleBefore = new Date(Date.now() - GRACE_PERIOD_MS);

	for (;;) {
		// sync-post uploads an attachment to S3 and inserts its attachments row
		// before the corresponding post_attachments row commits, so a very
		// recent row may just be mid-flight rather than truly orphaned - skip
		// anything younger than the grace period. Safety against a
		// concurrently-committing post_attachments insert doesn't come from
		// this being a single SQL statement - it comes from the
		// post_attachments -> attachments foreign key (onDelete: "cascade" in
		// posts.ts): inserting a post_attachments row takes a lock on the
		// referenced attachments row, which serializes against this DELETE. If
		// that FK is ever dropped, this safety goes with it.
		const candidateKey = db
			.select({ attachmentKey: attachments.attachmentKey })
			.from(attachments)
			.where(
				and(
					notExists(
						db
							.select({ attachmentKey: postAttachments.attachmentKey })
							.from(postAttachments)
							.where(
								eq(postAttachments.attachmentKey, attachments.attachmentKey),
							),
					),
					lt(attachments.lastModified, staleBefore),
				),
			)
			.limit(1);

		const [deleted] = await db
			.delete(attachments)
			.where(eq(attachments.attachmentKey, candidateKey))
			.returning({
				attachmentKey: attachments.attachmentKey,
				sha: attachments.sha,
				width: attachments.width,
				height: attachments.height,
			});

		if (!deleted) return;

		try {
			await s3.remove(bucket, deleted.attachmentKey);
		} catch (err) {
			// The row is already claimed/deleted, so a failed removal here would
			// otherwise permanently lose track of the S3 object - nothing would
			// ever find it again. Re-insert it (with a fresh lastModified) so the
			// next scheduled run picks it back up, then fail the job as a whole.
			await db
				.insert(attachments)
				.values({ ...deleted, lastModified: new Date() })
				.onConflictDoUpdate({
					target: attachments.attachmentKey,
					set: { lastModified: new Date() },
				});
			throw err;
		}

		console.log(
			`Removed unreferenced attachment ${deleted.attachmentKey} from S3`,
		);
	}
});
