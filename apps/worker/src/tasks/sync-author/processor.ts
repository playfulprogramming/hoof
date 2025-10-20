import { Tasks, env } from "@playfulprogramming/common";
import { db, profiles } from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { s3 } from "@playfulprogramming/s3";
import { createProcessor } from "../../createProcessor.ts";
import matter from "gray-matter";
import { AuthorMetaSchema } from "./types.ts";
import { Value } from "@sinclair/typebox/value";
import sharp from "sharp";
import { Readable } from "node:stream";

const PROFILE_IMAGE_SIZE_MAX = 2048;

async function processProfileImg(
	stream: ReadableStream<Uint8Array>,
	uploadKey: string,
) {
	const pipeline = sharp()
		.resize({
			width: PROFILE_IMAGE_SIZE_MAX,
			height: PROFILE_IMAGE_SIZE_MAX,
			fit: "inside",
		})
		.jpeg({ mozjpeg: true });

	Readable.fromWeb(stream as never).pipe(pipeline);

	const bucket = await s3.createBucket(env.S3_BUCKET);
	await s3.upload(bucket, uploadKey, undefined, pipeline, "image/jpeg");
}

export default createProcessor(Tasks.SYNC_AUTHOR, async (job, { signal }) => {
	const authorId = job.data.author;
	const authorMetaUrl = new URL(
		`content/${encodeURIComponent(authorId)}/index.md`,
		"http://localhost",
	);

	const authorMetaRaw = await github.getContentsRaw({
		ref: job.data.ref,
		path: authorMetaUrl.pathname,
		repoOwner: env.GITHUB_REPO_OWNER,
		repoName: env.GITHUB_REPO_NAME,
		signal,
	});

	const { data } = matter(authorMetaRaw);
	const authorData = Value.Parse(AuthorMetaSchema, data);

	let profileImgKey: string | null = null;
	if (authorData.profileImg) {
		const profileImgUrl = new URL(authorData.profileImg, authorMetaUrl);
		const profileImgStream = await github.getContentsRawStream({
			ref: job.data.ref,
			path: profileImgUrl.pathname,
			repoOwner: env.GITHUB_REPO_OWNER,
			repoName: env.GITHUB_REPO_NAME,
			signal,
		});
		profileImgKey = `profiles/${authorId}.jpeg`;
		await processProfileImg(profileImgStream, profileImgKey);
	}

	const result = {
		slug: authorId,
		name: authorData.name,
		description: authorData.description,
		profileImage: profileImgKey,
		meta: {
			socials: authorData.socials,
			roles: authorData.roles,
		},
	};

	await db
		.insert(profiles)
		.values(result)
		.onConflictDoUpdate({ target: profiles.slug, set: result });
});
