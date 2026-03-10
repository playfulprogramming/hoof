import { env } from "@playfulprogramming/common";

/**
 * Constructs a full S3 image URL from a relative path.
 * @param path - The relative path to the image.
 * @returns The absolute URL to the image.
 */
export function createImageUrl(path: string): string {
	const trimSlashes = (input: string) => input.replace(/^\/+|\/+$/g, "");

	const s3PublicUrl = `${trimSlashes(env.S3_PUBLIC_URL)}/${trimSlashes(env.S3_BUCKET)}/`;
	return new URL(trimSlashes(path), s3PublicUrl).toString();
}
