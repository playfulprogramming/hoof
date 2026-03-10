import { env } from "@playfulprogramming/common";

export function createImageUrl(path: string): string {
	const s3PublicUrl = `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/`;
	return new URL(path, s3PublicUrl).toString();
}
