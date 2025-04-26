import {
	BucketAlreadyExists,
	BucketAlreadyOwnedByYou,
	CreateBucketCommand,
	GetObjectCommand,
	NoSuchKey,
	PutBucketPolicyCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import * as stream from "stream";

const client = new S3Client({
	region: "auto",
	endpoint: process.env.S3_ENDPOINT,
	credentials: {
		accessKeyId: process.env.S3_KEY_ID,
		secretAccessKey: process.env.S3_KEY_SECRET,
	},
	forcePathStyle: true,
});

export async function createBucket(name: string) {
	if (process.env.ENVIRONMENT === "production") return name;

	try {
		await client.send(new CreateBucketCommand({ Bucket: name }));

		const publicBucketPolicy = {
			Version: "2012-10-17",
			Statement: [
				{
					Action: ["s3:GetObject"],
					Effect: "Allow",
					Principal: { AWS: ["*"] },
					Resource: [`arn:aws:s3:::${name}/*`],
					Sid: "",
				},
			],
		};

		await client.send(
			new PutBucketPolicyCommand({
				Bucket: name,
				Policy: JSON.stringify(publicBucketPolicy),
			})
		);

		console.log(`Created bucket '${name}'`);
	} catch (e) {
		if (
			e instanceof BucketAlreadyExists ||
			e instanceof BucketAlreadyOwnedByYou
		) {
			console.log(`Bucket '${name}' already exists`);
		} else {
			console.error(e, `Error creating bucket '${name}'`);
			throw e;
		}
	}
	return name;
}

export async function exists(bucket: string, key: string) {
	try {
		const obj = await client.send(
			new GetObjectCommand({ Bucket: bucket, Key: key })
		);
		return !!obj;
	} catch (e) {
		if (e instanceof NoSuchKey) return false;
		throw e;
	}
}

export async function upload(
	bucket: string,
	key: string,
	tags: Record<string, string>,
	file: stream.Readable,
	contentType: string
) {
	console.log(`Uploading ${bucket}/${key}`);
	const searchParams = new URLSearchParams(tags);

	const upload = new Upload({
		params: {
			Bucket: bucket,
			Key: key,
			Body: file,
			ContentType: contentType,
			Tagging: searchParams.toString(),
		},
		client,
	});

	upload.on("httpUploadProgress", (progress) =>
		console.log({
			msg: "Upload progress",
			progress: Number(progress.loaded) / Number(progress.total),
			bucket: progress.Bucket,
			key: progress.Key,
		})
	);

	await upload.done();
}
