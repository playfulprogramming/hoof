import { env, AuthorMetaSchema, BRANCH_MAIN } from "@playfulprogramming/common";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import {
	db,
	authors,
	authorAchievements,
	authorRoles,
	authorSlugs,
} from "@playfulprogramming/db";
import { createInstallationClient } from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import matter from "gray-matter";
import { Value } from "typebox/value";
import { and, eq, inArray } from "drizzle-orm";
import { MANUAL_ACHIEVEMENT_IDS } from "../grant-author-achievements/achievement-ids.ts";
import { uploadProcessedImage } from "../../utils/uploadProcessedImage.ts";

const PROFILE_IMAGE_SIZE_MAX = 2048;

export default createProcessor(Tasks.SYNC_AUTHOR, async (job, { signal }) => {
	const authorSlug = job.data.author;
	const authorMetaUrl = new URL(
		`content/${encodeURIComponent(authorSlug)}/index.md`,
		"http://localhost",
	);
	const github = await createInstallationClient(job.data.installation.id);

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
				`Metadata for ${authorSlug} (${authorMetaUrl.pathname}) returned 404 - removing profile entry.`,
			);
			await db
				.delete(authors)
				.where(
					and(
						eq(authors.slug, authorSlug),
						eq(authors.branch, job.data.branch),
					),
				);
			return;
		}

		throw new Error(`Unable to fetch author data for ${authorSlug}`);
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
				`Unable to fetch profile image for ${authorSlug} (${profileImgUrl.pathname})`,
			);
		}

		profileImgKey = `profiles/${authorSlug}.jpeg`;
		await uploadProcessedImage(
			profileImgStream,
			profileImgKey,
			PROFILE_IMAGE_SIZE_MAX,
			signal,
		);
	}

	const result = {
		slug: authorSlug,
		branch: job.data.branch,
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
			.insert(authorSlugs)
			.values({ slug: authorSlug })
			.onConflictDoNothing();

		await tx
			.insert(authors)
			.values(result)
			.onConflictDoUpdate({
				target: [authors.slug, authors.branch],
				set: result,
			})
			.returning({ id: authors.id });

		if (job.data.branch === BRANCH_MAIN) {
			await tx
				.delete(authorAchievements)
				.where(
					and(
						eq(authorAchievements.authorSlug, authorSlug),
						inArray(
							authorAchievements.achievementId,
							MANUAL_ACHIEVEMENT_IDS as unknown as string[],
						),
					),
				);

			if (earnedManualIds.length > 0) {
				await tx.insert(authorAchievements).values(
					earnedManualIds.map((achievementId: string) => ({
						authorSlug,
						achievementId,
					})),
				);
			}

			await tx
				.delete(authorRoles)
				.where(eq(authorRoles.authorSlug, authorSlug));

			if (authorData.roles.length > 0) {
				await tx.insert(authorRoles).values(
					authorData.roles.map((role) => ({
						authorSlug,
						role,
					})),
				);
			}
		}
	});

	if (job.data.branch === BRANCH_MAIN) {
		await createJob(
			Tasks.GRANT_AUTHOR_ACHIEVEMENTS,
			`grant-author-achievements:${authorSlug}`,
			{ authorSlug, installation: job.data.installation },
		);
	}
});
