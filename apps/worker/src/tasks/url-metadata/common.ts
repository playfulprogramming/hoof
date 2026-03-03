import { s3 } from "@playfulprogramming/s3";
import type { ProcessImageResult } from "./utils/processImage.ts";
import { env } from "@playfulprogramming/common";

export type EmbedData = {
	title?: string;
	icon?: ProcessImageResult;
	banner?: ProcessImageResult;
	embedSrc?: string;
	embedWidth?: number;
	embedHeight?: number;
	gistId?: string;
	postId?: string;
	error: boolean;
};

export const BUCKET = await s3.ensureBucket(env.S3_BUCKET);
