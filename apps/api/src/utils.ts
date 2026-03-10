import { env } from "@playfulprogramming/common";

/**
 * Constructs a full S3 image URL from a relative path.
 * @param path - The relative path to the image.
 * @returns The absolute URL to the image.
 */
export function createImageUrl(path: string): string {
	const s3PublicUrl = `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/`;
	return new URL(path, s3PublicUrl).toString();
}
