import { env } from "@playfulprogramming/common";

/** Removes leading and trailing slashes from a string. */
function trimSlashes(input: string): string {
	return input.replace(/^\/+|\/+$/g, "");
}

const S3_BASE_URL = `${trimSlashes(env.S3_PUBLIC_URL)}/${trimSlashes(env.S3_BUCKET)}/`;
/**
 * Constructs a full S3 image URL from a relative path.
 * @param path The relative path to the image.
 * @returns The absolute URL to the image.
 */
export function createImageUrl(path: string): string {
	return new URL(trimSlashes(path), S3_BASE_URL).toString();
}
