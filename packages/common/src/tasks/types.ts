import type { UrlMetadataInput, UrlMetadataOutput } from "./url-metadata.ts";
import type { PostImageInput } from "./post-image.ts";

export const Tasks = {
	URL_METADATA: "url-metadata",
	POST_IMAGE: "post-image",
} as const;

export type TasksKeys = keyof typeof Tasks;
export type TasksValues = (typeof Tasks)[TasksKeys];

export interface TaskInputs {
	[Tasks.URL_METADATA]: UrlMetadataInput;
	[Tasks.POST_IMAGE]: PostImageInput;
}

export type TaskInputsValues = TaskInputs[TasksValues];

export interface TaskOutputs {
	[Tasks.URL_METADATA]: UrlMetadataOutput;
	[Tasks.POST_IMAGE]: void;
}

export type TaskOutputsValues = TaskOutputs[TasksValues];
