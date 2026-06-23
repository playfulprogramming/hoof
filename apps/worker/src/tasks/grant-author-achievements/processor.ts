import { Tasks } from "@playfulprogramming/bullmq";
import {
	db,
	profileAchievements,
	postAuthors,
	postData,
	collectionAuthors,
} from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import { and, eq, inArray, max, count, ne } from "drizzle-orm";
import { ACHIEVEMENT_RULES, ALL_POSSIBLE_AUTO_IDS } from "./achievement-ids.ts";

export default createProcessor(Tasks.GRANT_AUTHOR_ACHIEVEMENTS, async (job) => {
	const { profileSlug, ref: _ref } = job.data;

	const profile = await db.query.profiles.findFirst({
		where: { slug: profileSlug },
	});

	if (!profile) {
		console.log(
			`grant-author-achievements: profile ${profileSlug} not found, skipping.`,
		);
		return;
	}

	const meta = profile.meta as {
		roles?: string[];
		socials?: Record<string, string>;
	};
	const roles = meta.roles ?? [];
	const githubLogin = meta.socials?.github;

	// ── Content stats ─────────────────────────────────────────────────────────

	// Word count per post (English locale only, matching frontend behaviour).
	// We take the max across versions since postData has a composite PK of
	// (slug, locale, version).
	const wordCountRows = await db
		.select({
			postSlug: postAuthors.postSlug,
			wordCount: max(postData.wordCount),
		})
		.from(postAuthors)
		.innerJoin(
			postData,
			and(eq(postData.slug, postAuthors.postSlug), eq(postData.locale, "en")),
		)
		.where(eq(postAuthors.authorSlug, profileSlug))
		.groupBy(postAuthors.postSlug);

	const postCount = wordCountRows.length;
	const maxPostWordCount = wordCountRows.reduce(
		(acc, r) => Math.max(acc, r.wordCount ?? 0),
		0,
	);
	const totalWordCount = wordCountRows.reduce(
		(acc, r) => acc + (r.wordCount ?? 0),
		0,
	);

	// Co-authored: any post this author shares with at least one other author.
	// We already have the post slugs, so just look for rows with a different authorSlug.
	let hasCoAuthoredPost = false;
	if (wordCountRows.length > 0) {
		const postSlugs = wordCountRows.map((r) => r.postSlug);
		const coAuthorRows = await db
			.select({ value: count() })
			.from(postAuthors)
			.where(
				and(
					inArray(postAuthors.postSlug, postSlugs),
					ne(postAuthors.authorSlug, profileSlug),
				),
			);
		hasCoAuthoredPost = (coAuthorRows[0]?.value ?? 0) > 0;
	}

	// Collection count
	const collectionCountResult = await db
		.select({ value: count() })
		.from(collectionAuthors)
		.where(eq(collectionAuthors.authorSlug, profileSlug));
	const collectionCount = collectionCountResult[0]?.value ?? 0;

	// ── GitHub stats ──────────────────────────────────────────────────────────

	const githubStats = githubLogin
		? await github.getAuthorGitHubStats(githubLogin)
		: undefined;

	// ── Evaluate rules ────────────────────────────────────────────────────────

	const earnedIds = ACHIEVEMENT_RULES.filter((rule) =>
		rule.check({
			roles,
			postCount,
			maxPostWordCount,
			totalWordCount,
			hasCoAuthoredPost,
			collectionCount,
			github: githubStats,
		}),
	).map((rule) => rule.id);

	// ── Write results ─────────────────────────────────────────────────────────
	// Delete all rows for this profile that are in the auto-computed set, then
	// re-insert only the earned subset. Manual achievement rows are never touched.

	await db.transaction(async (tx) => {
		await tx
			.delete(profileAchievements)
			.where(
				and(
					eq(profileAchievements.profileSlug, profileSlug),
					inArray(profileAchievements.achievementId, ALL_POSSIBLE_AUTO_IDS),
				),
			);

		if (earnedIds.length > 0) {
			await tx.insert(profileAchievements).values(
				earnedIds.map((achievementId) => ({
					profileSlug,
					achievementId,
				})),
			);
		}
	});

	console.log(
		`grant-author-achievements: ${profileSlug} → ${earnedIds.length} auto achievements granted (${earnedIds.join(", ")})`,
	);
});
