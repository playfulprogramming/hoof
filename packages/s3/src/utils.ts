import {
	BucketAlreadyExists,
	BucketAlreadyOwnedByYou,
	CreateBucketCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	NoSuchKey,
	PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type * as stream from "stream";
import { env } from "@playfulprogramming/common";
import { client } from "./client.ts";

export async function ensureBucket(name: string) {
	if (env.ENVIRONMENT === "production") return name;

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
			}),
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
			new GetObjectCommand({ Bucket: bucket, Key: key }),
		);
		return !!obj;
	} catch (e) {
		if (e instanceof NoSuchKey) return false;
		throw e;
	}
}

export async function remove(bucket: string, key: string) {
	await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export interface S3Object {
	key: string;
	lastModified: Date;
}

export async function list(
	bucket: string,
	prefix: string,
): Promise<S3Object[]> {
	const objects: S3Object[] = [];
	let continuationToken: string | undefined;

	do {
		const response = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: continuationToken,
			}),
		);

		for (const object of response.Contents ?? []) {
			if (object.Key && object.LastModified) {
				objects.push({ key: object.Key, lastModified: object.LastModified });
			}
		}

		continuationToken = response.IsTruncated
			? response.NextContinuationToken
			: undefined;
	} while (continuationToken);

	return objects;
}

export async function matchesEtag(
	bucket: string,
	key: string,
	etag: string,
): Promise<boolean> {
	try {
		const obj = await client.send(
			new HeadObjectCommand({ Bucket: bucket, Key: key, IfMatch: etag }),
		);
		return !!obj;
	} catch (_e) {
		return false;
	}
}

export async function upload(
	bucket: string,
	key: string,
	tag: string | undefined,
	file: stream.Readable | Buffer,
	contentType: string,
) {
	console.log(`Uploading ${bucket}/${key}`);

	const upload = new Upload({
		params: {
			Bucket: bucket,
			Key: key,
			Body: file,
			ContentType: contentType,
			Tagging: tag,
		},
		client,
	});

	upload.on("httpUploadProgress", (progress) =>
		console.log({
			msg: "Upload progress",
			progress: Number(progress.loaded) / Number(progress.total),
			bucket: progress.Bucket,
			key: progress.Key,
		}),
	);

	await upload.done();

	console.log(`Uploaded ${bucket}/${key}`);
}
