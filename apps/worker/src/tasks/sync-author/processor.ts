import { env, AuthorMetaSchema } from "@playfulprogramming/common";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import {
	db,
	profiles,
	profileAchievements,
	authorRoles,
} from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import matter from "gray-matter";
import { Value } from "typebox/value";
import { and, eq, inArray } from "drizzle-orm";
import { MANUAL_ACHIEVEMENT_IDS } from "../grant-author-achievements/achievement-ids.ts";
import { uploadProcessedImage } from "../../utils/uploadProcessedImage.ts";

const PROFILE_IMAGE_SIZE_MAX = 2048;

export default createProcessor(Tasks.SYNC_AUTHOR, async (job, { signal }) => {
	const authorId = job.data.author;
	const authorMetaUrl = new URL(
		`content/${encodeURIComponent(authorId)}/index.md`,
		"http://localhost",
	);

	const authorMetaResponse = await github.getContentsRaw({
		ref: job.data.ref,
		path: authorMetaUrl.pathname,
		repoOwner: env.GITHUB_REPO_OWNER,
		repoName: env.GITHUB_REPO_NAME,
		signal,
	});

	if (authorMetaResponse.data === undefined) {
		if (authorMetaResponse.status == 404) {
			console.log(
				`Metadata for ${authorId} (${authorMetaUrl.pathname}) returned 404 - removing profile entry.`,
			);
			await db.delete(profiles).where(eq(profiles.slug, authorId));
			return;
		}

		throw new Error(`Unable to fetch author data for ${authorId}`);
	}

	const { data } = matter(authorMetaResponse.data);
	const authorData = Value.Parse(AuthorMetaSchema, data);

	let profileImgKey: string | null = null;
	if (authorData.profileImg) {
		const profileImgUrl = new URL(authorData.profileImg, authorMetaUrl);
		const { data: profileImgStream } = await github.getContentsRawStream({
			ref: job.data.ref,
			path: profileImgUrl.pathname,
			repoOwner: env.GITHUB_REPO_OWNER,
			repoName: env.GITHUB_REPO_NAME,
			signal,
		});

		if (profileImgStream === null || typeof profileImgStream === "undefined") {
			throw new Error(
				`Unable to fetch profile image for ${authorId} (${profileImgUrl.pathname})`,
			);
		}

		profileImgKey = `profiles/${authorId}.jpeg`;
		await uploadProcessedImage(
			profileImgStream,
			profileImgKey,
			PROFILE_IMAGE_SIZE_MAX,
			signal,
		);
	}

	const result = {
		slug: authorId,
		name: authorData.name,
		description: authorData.description,
		profileImage: profileImgKey,
		meta: {
			socials: authorData.socials,
		},
	};

	const earnedManualIds = [...new Set(authorData.achievements)].filter(
		(id): id is (typeof MANUAL_ACHIEVEMENT_IDS)[number] =>
			(MANUAL_ACHIEVEMENT_IDS as readonly string[]).includes(id),
	);

	await db.transaction(async (tx) => {
		await tx
			.insert(profiles)
			.values(result)
			.onConflictDoUpdate({ target: profiles.slug, set: result });

		await tx
			.delete(profileAchievements)
			.where(
				and(
					eq(profileAchievements.profileSlug, authorId),
					inArray(
						profileAchievements.achievementId,
						MANUAL_ACHIEVEMENT_IDS as unknown as string[],
					),
				),
			);

		if (earnedManualIds.length > 0) {
			await tx.insert(profileAchievements).values(
				earnedManualIds.map((achievementId) => ({
					profileSlug: authorId,
					achievementId,
				})),
			);
		}

		await tx.delete(authorRoles).where(eq(authorRoles.profileSlug, authorId));

		if (authorData.roles.length > 0) {
			await tx.insert(authorRoles).values(
				authorData.roles.map((role) => ({
					profileSlug: authorId,
					role,
				})),
			);
		}
	});

	await createJob(
		Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
		`grant-author-achievements:${authorId}`,
		{ profileSlug: authorId },
	);
});
