import { env } from "@playfulprogramming/common";
import { Tasks } from "@playfulprogramming/bullmq";
import { db, postAttachments } from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import { createProcessor } from "../../createProcessor.ts";

const ATTACHMENTS_PREFIX = "posts/";
const GRACE_PERIOD_MS = 60 * 60 * 1000;

export default createProcessor(Tasks.CLEANUP_ATTACHMENTS, async () => {
	const bucket = await s3.ensureBucket(env.S3_BUCKET);

	const objects = await s3.list(bucket, ATTACHMENTS_PREFIX);
	const now = Date.now();

	// sync-post uploads an attachment to S3 before its post_attachments row is
	// committed, so a very recent object may just be mid-flight rather than
	// truly orphaned - skip anything younger than the grace period.
	const candidateKeys = objects
		.filter((object) => object.key.includes("/attachments/"))
		.filter((object) => now - object.lastModified.getTime() > GRACE_PERIOD_MS)
		.map((object) => object.key);

	if (candidateKeys.length === 0) return;

	const referencedRows = await db
		.select({ attachmentKey: postAttachments.attachmentKey })
		.from(postAttachments);
	const referencedKeys = new Set(
		referencedRows.map((row) => row.attachmentKey),
	);

	for (const key of candidateKeys) {
		if (referencedKeys.has(key)) continue;

		await s3.remove(bucket, key);
		console.log(`Removed unreferenced attachment ${key} from S3`);
	}
});
