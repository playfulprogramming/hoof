import type { UrlMetadataInput, UrlMetadataOutput } from "./url-metadata.ts";
import type { PostImageInput, PostImageOutput } from "./post-image.ts";

export const Tasks = {
	URL_METADATA: "url-metadata",
	POST_IMAGES: "post-images",
} as const;

export type TasksKeys = keyof typeof Tasks;
export type TasksValues = (typeof Tasks)[TasksKeys];

export interface TaskInputs {
	[Tasks.URL_METADATA]: UrlMetadataInput;
	[Tasks.POST_IMAGES]: PostImageInput;
}

export type TaskInputsValues = TaskInputs[TasksValues];

export interface TaskOutputs {
	[Tasks.URL_METADATA]: UrlMetadataOutput;
	[Tasks.POST_IMAGES]: PostImageOutput;
}

export type TaskOutputsValues = TaskOutputs[TasksValues];
