import type { UrlMetadataInput, UrlMetadataOutput } from "./url-metadata.ts";
import type { PostImageInput, PostImageOutput } from "./post-image.ts";
import type { SyncAuthorInput, SyncAuthorOutput } from "./sync-author.ts";
import type {
	SyncCollectionInput,
	SyncCollectionOutput,
} from "./sync-collection.ts";
import type { SyncPostInput, SyncPostOutput } from "./sync-post.ts";

export const Tasks = {
	SYNC_AUTHOR: "sync-author",
	SYNC_COLLECTION: "sync-collection",
	SYNC_POST: "sync-post",
	URL_METADATA: "url-metadata",
	POST_IMAGES: "post-images",
} as const;

export type TasksKeys = keyof typeof Tasks;
export type TasksValues = (typeof Tasks)[TasksKeys];

export interface TaskInputs {
	[Tasks.SYNC_AUTHOR]: SyncAuthorInput;
	[Tasks.SYNC_COLLECTION]: SyncCollectionInput;
	[Tasks.SYNC_POST]: SyncPostInput;
	[Tasks.URL_METADATA]: UrlMetadataInput;
	[Tasks.POST_IMAGES]: PostImageInput;
}

export type TaskInputsValues = TaskInputs[TasksValues];

export interface TaskOutputs {
	[Tasks.SYNC_AUTHOR]: SyncAuthorOutput;
	[Tasks.SYNC_COLLECTION]: SyncCollectionOutput;
	[Tasks.SYNC_POST]: SyncPostOutput;
	[Tasks.URL_METADATA]: UrlMetadataOutput;
	[Tasks.POST_IMAGES]: PostImageOutput;
}

export type TaskOutputsValues = TaskOutputs[TasksValues];
