import { env } from "@playfulprogramming/common";
import { Tasks } from "@playfulprogramming/bullmq";
import { db, postAttachments } from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import { createProcessor } from "../../createProcessor.ts";

const ATTACHMENTS_PREFIX = "posts/";

export default createProcessor(Tasks.CLEANUP_ATTACHMENTS, async () => {
	const bucket = await s3.ensureBucket(env.S3_BUCKET);

	const objectKeys = await s3.list(bucket, ATTACHMENTS_PREFIX);
	const attachmentKeys = objectKeys.filter((key) =>
		key.includes("/attachments/"),
	);

	if (attachmentKeys.length === 0) return;

	const referencedRows = await db
		.select({ attachmentKey: postAttachments.attachmentKey })
		.from(postAttachments);
	const referencedKeys = new Set(
		referencedRows.map((row) => row.attachmentKey),
	);

	for (const key of attachmentKeys) {
		if (referencedKeys.has(key)) continue;

		await s3.remove(bucket, key);
		console.log(`Removed unreferenced attachment ${key} from S3`);
	}
});
