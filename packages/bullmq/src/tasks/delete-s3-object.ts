import { s3 } from "@playfulprogramming/s3";
import { createJob } from "../queues.ts";
import { Tasks } from "./types.ts";

export interface DeleteS3ObjectInput {
	bucket: string;
	key: string;
	// ISO timestamp of the object's LastModified at scheduling time. The
	// processor re-checks this before deleting, so a key that gets rewritten
	// in the meantime (even with byte-identical content, which leaves its
	// ETag unchanged) doesn't get deleted out from under its new reference.
	lastModified?: string;
}

export type DeleteS3ObjectOutput = void;

// Grace period before a scheduled S3 deletion actually runs, so the frontend
// or CDN doesn't hit a 404 for a key it just fetched or cached.
export const DELETE_S3_OBJECT_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export async function scheduleS3ObjectDeletion(
	bucket: string,
	key: string,
): Promise<void> {
	const lastModified = await s3.getLastModified(bucket, key);
	const lastModifiedIso = lastModified?.toISOString();

	// The job ID includes a generation marker (the object's LastModified, or
	// a random ID when that couldn't be read) so that scheduling a deletion
	// for a key that's since been rewritten gets its own job instead of
	// silently deduplicating against - and being dropped in favor of - a
	// still-pending job for the previous generation of that key.
	await createJob(
		Tasks.DELETE_S3_OBJECT,
		`delete-s3-object:${bucket}:${key}:${lastModifiedIso ?? crypto.randomUUID()}`,
		{ bucket, key, lastModified: lastModifiedIso },
		{ delay: DELETE_S3_OBJECT_GRACE_PERIOD_MS },
	);
}
