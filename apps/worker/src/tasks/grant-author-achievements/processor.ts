import { Tasks } from "@playfulprogramming/bullmq";
import {
	db,
	authorAchievements,
	postAuthors,
	collectionAuthors,
	collectionData,
	posts,
} from "@playfulprogramming/db";
import * as github from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import { and, eq, inArray, count, ne, isNotNull } from "drizzle-orm";
import { ACHIEVEMENT_RULES, ALL_POSSIBLE_AUTO_IDS } from "./achievement-ids.ts";

export default createProcessor(Tasks.GRANT_AUTHOR_ACHIEVEMENTS, async (job) => {
	const { authorSlug } = job.data;

	const author = await db.query.authors.findFirst({
		where: { slug: authorSlug },
	});

	if (!author) {
		throw new Error(
			`grant-author-achievements: author ${authorSlug} not found.`,
		);
	}

	const meta = author.meta as {
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
			postId: posts.id,
			wordCount: posts.wordCount,
		})
		.from(posts)
		.innerJoin(
			postAuthors,
			and(
				eq(postAuthors.postId, posts.id),
				eq(postAuthors.authorSlug, authorSlug),
			),
		)
		.where(
			and(
				eq(posts.locale, "en"),
				eq(posts.branch, "main"),
				isNotNull(posts.publishedAt),
			),
		);

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
		const postIds = wordCountRows.map((r) => r.postId);
		const coAuthorRows = await db
			.select({ value: count() })
			.from(postAuthors)
			.where(
				and(
					inArray(postAuthors.postId, postIds),
					ne(postAuthors.authorSlug, authorSlug),
				),
			);
		hasCoAuthoredPost = (coAuthorRows[0]?.value ?? 0) > 0;
	}

	// Collection count
	const collectionCountResult = await db
		.select({ value: count() })
		.from(collectionAuthors)
		.innerJoin(
			collectionData,
			and(
				eq(collectionData.slug, collectionAuthors.collectionSlug),
				eq(collectionData.locale, "en"),
			),
		)
		.where(
			and(
				eq(collectionAuthors.authorSlug, authorSlug),
				isNotNull(collectionData.publishedAt),
			),
		);
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
	// Delete all rows for this author that are in the auto-computed set, then
	// re-insert only the earned subset. Manual achievement rows are never touched.

	await db.transaction(async (tx) => {
		await tx
			.delete(authorAchievements)
			.where(
				and(
					eq(authorAchievements.authorSlug, authorSlug),
					inArray(authorAchievements.achievementId, ALL_POSSIBLE_AUTO_IDS),
				),
			);

		if (earnedIds.length > 0) {
			await tx.insert(authorAchievements).values(
				earnedIds.map((achievementId) => ({
					authorSlug,
					achievementId,
				})),
			);
		}
	});

	console.log(
		`grant-author-achievements: ${authorSlug} → ${earnedIds.length} auto achievements granted (${earnedIds.join(", ")})`,
	);
});
