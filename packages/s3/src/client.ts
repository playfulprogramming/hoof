import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@playfulprogramming/common";

export const client = new S3Client({
	region: "auto",
	endpoint: env.S3_ENDPOINT,
	credentials: {
		accessKeyId: env.S3_KEY_ID,
		secretAccessKey: env.S3_KEY_SECRET,
	},
	forcePathStyle: true,
});
