import { Tasks } from "@playfulprogramming/bullmq";
import { s3 } from "@playfulprogramming/s3";
import { createProcessor } from "../../createProcessor.ts";

export default createProcessor(Tasks.DELETE_S3_OBJECT, async (job) => {
	const { bucket, key, lastModified } = job.data;

	if (lastModified !== undefined) {
		const stillUnmodified = await s3.unmodifiedSince(
			bucket,
			key,
			new Date(lastModified),
		);

		if (!stillUnmodified) {
			console.log(
				`Skipped removal of ${bucket}/${key} - object was rewritten since deletion was scheduled`,
			);
			return;
		}
	}

	await s3.remove(bucket, key);
	console.log(`Removed ${bucket}/${key} from S3 after grace period`);
});
