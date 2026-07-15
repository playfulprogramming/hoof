import { createJob } from "../queues.ts";
import { Tasks } from "./types.ts";

export interface DeleteS3ObjectInput {
	bucket: string;
	key: string;
}

export type DeleteS3ObjectOutput = void;

// Grace period before a scheduled S3 deletion actually runs, so the frontend
// or CDN doesn't hit a 404 for a key it just fetched or cached.
export const DELETE_S3_OBJECT_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export async function scheduleS3ObjectDeletion(
	bucket: string,
	key: string,
): Promise<void> {
	await createJob(
		Tasks.DELETE_S3_OBJECT,
		`delete-s3-object:${bucket}:${key}`,
		{ bucket, key },
		{ delay: DELETE_S3_OBJECT_GRACE_PERIOD_MS },
	);
}
