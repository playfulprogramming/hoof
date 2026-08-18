import { s3 } from "@playfulprogramming/s3";
import { enqueueS3ObjectDeletion } from "@playfulprogramming/bullmq";

export async function scheduleS3ObjectDeletion(
	bucket: string,
	key: string,
): Promise<void> {
	const lastModified = await s3.getLastModified(bucket, key);

	if (lastModified === undefined) {
		// Without a LastModified to check at execution time, the processor
		// would have no way to detect a rewrite during the grace period and
		// would unconditionally delete whatever's at this key 24h from now -
		// including a legitimate new upload. Bail out instead of scheduling
		// an unsafe deletion, but log it: a genuine transient failure to read
		// the object's metadata here means this object never gets scheduled
		// for cleanup at all, so it'd otherwise leak in S3 with no trace.
		console.warn(
			`Skipped scheduling deletion of ${bucket}/${key} - could not read its LastModified`,
		);
		return;
	}

	await enqueueS3ObjectDeletion(bucket, key, lastModified);
}
