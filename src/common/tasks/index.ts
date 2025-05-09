import { UrlMetadataInput } from "./url-metadata.ts";
import { PostImageInput } from "./post-image.ts";

export enum Tasks {
	URL_METADATA = "url-metadata",
	POST_IMAGE = "post-image",
}

export interface TaskInputs {
	[Tasks.URL_METADATA]: UrlMetadataInput;
	[Tasks.POST_IMAGE]: PostImageInput;
}
