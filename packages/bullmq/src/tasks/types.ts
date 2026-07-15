import type { UrlMetadataInput, UrlMetadataOutput } from "./url-metadata.ts";
import type { PostImageInput, PostImageOutput } from "./post-image.ts";
import type { SyncAuthorInput, SyncAuthorOutput } from "./sync-author.ts";
import type {
	SyncCollectionInput,
	SyncCollectionOutput,
} from "./sync-collection.ts";
import type { SyncPostInput, SyncPostOutput } from "./sync-post.ts";
import type { SyncAllInput } from "./sync-all.ts";
import type {
	GrantAuthorAchievementsInput,
	GrantAuthorAchievementsOutput,
} from "./grant-author-achievements.ts";
import type {
	DeleteS3ObjectInput,
	DeleteS3ObjectOutput,
} from "./delete-s3-object.ts";

export const Tasks = {
	SYNC_ALL: "sync-all",
	SYNC_AUTHOR: "sync-author",
	SYNC_COLLECTION: "sync-collection",
	SYNC_POST: "sync-post",
	URL_METADATA: "url-metadata",
	POST_IMAGES: "post-images",
	GRANT_AUTHOR_ACHIEVEMENTS: "grant-author-achievements",
	DELETE_S3_OBJECT: "delete-s3-object",
} as const;

export type TasksKeys = keyof typeof Tasks;
export type TasksValues = (typeof Tasks)[TasksKeys];

export interface TaskInputs {
	[Tasks.SYNC_ALL]: SyncAllInput;
	[Tasks.SYNC_AUTHOR]: SyncAuthorInput;
	[Tasks.SYNC_COLLECTION]: SyncCollectionInput;
	[Tasks.SYNC_POST]: SyncPostInput;
	[Tasks.URL_METADATA]: UrlMetadataInput;
	[Tasks.POST_IMAGES]: PostImageInput;
	[Tasks.GRANT_AUTHOR_ACHIEVEMENTS]: GrantAuthorAchievementsInput;
	[Tasks.DELETE_S3_OBJECT]: DeleteS3ObjectInput;
}

export type TaskInputsValues = TaskInputs[TasksValues];

export interface TaskOutputs {
	[Tasks.SYNC_ALL]: object;
	[Tasks.SYNC_AUTHOR]: SyncAuthorOutput;
	[Tasks.SYNC_COLLECTION]: SyncCollectionOutput;
	[Tasks.SYNC_POST]: SyncPostOutput;
	[Tasks.URL_METADATA]: UrlMetadataOutput;
	[Tasks.POST_IMAGES]: PostImageOutput;
	[Tasks.GRANT_AUTHOR_ACHIEVEMENTS]: GrantAuthorAchievementsOutput;
	[Tasks.DELETE_S3_OBJECT]: DeleteS3ObjectOutput;
}

export type TaskOutputsValues = TaskOutputs[TasksValues];
