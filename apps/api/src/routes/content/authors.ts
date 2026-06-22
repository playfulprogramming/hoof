import type { FastifyPluginAsync } from "fastify";
import { db, postAuthors, postData } from "@playfulprogramming/db";
import { Type, type Static } from "typebox";
import { and, eq, sum } from "drizzle-orm";
import { createImageUrl } from "../../utils.ts";

// ── Achievement display map ────────────────────────────────────────────────────

type AchievementDisplay = { name: string; body: string };

const FIXED_ACHIEVEMENT_DISPLAY: Record<string, AchievementDisplay> = {
	// Manual
	"site-redesign": { name: "Redesign Ruler", body: "Led a site-wide redesign" },
	"site-logo": { name: "Logo Legacy", body: "Made our Unicorn logo!" },
	"code-challenge": {
		name: "Code Challenger",
		body: "Make a code challenge in our Discord",
	},
	partner: {
		name: "Proud partner",
		body: "Become a Playful Programming Partner",
	},
	"messages-200": {
		name: "Moderate Messager",
		body: "Send 200 messages in our Discord",
	},
	"messages-500": {
		name: "Monstrous Messager",
		body: "Send 500 messages in our Discord",
	},
	"messages-1000": {
		name: "Message Madness",
		body: "Send 1000 messages in our Discord",
	},
	// Role-based
	"hello-world": { name: "Hello, World!", body: "Earn your first role badge" },
	"badge-collector": {
		name: "Badge Collector",
		body: "Have at least 3 role badges",
	},
	"localizer-9000": {
		name: "Localizer 9000",
		body: "Translate part of Playful Programming into another language!",
	},
	"community-crowned": {
		name: "Community crowned",
		body: "Become a community leader",
	},
	// Content-based
	"words-words-words": {
		name: "Words words words",
		body: "", // body is computed dynamically from total word count
	},
	"it-keeps-going": {
		name: "It Keeps Going",
		body: "Write a really long article",
	},
	"politely-posting": { name: "Politely Posting", body: "Write 3 articles!" },
	"profusely-posting": {
		name: "Profusely Posting",
		body: "Write 5 articles!",
	},
	"post-palooza": { name: "Post-palooza", body: "Write 10 articles!" },
	"cream-of-the-crop": {
		name: "Cream of the crop",
		body: "Write 30 articles!",
	},
	"team-player": {
		name: "Team Player",
		body: "Collaborate on an article with another author",
	},
	"collect-em-all": {
		name: "Collect 'em all",
		body: "Author a collection of posts!",
	},
	// GitHub-based — issues
	bug: { name: "Bug!", body: "Open an issue in our GitHub repo" },
	"creepy-crawlies": {
		name: "Creepy crawlies!",
		body: "Open 10 issues in our GitHub repo",
	},
	"insect-infestation": {
		name: "Insect infestation!",
		body: "Open 25 issues in our GitHub repo",
	},
	// GitHub-based — PRs
	"request-ranger": {
		name: "Request Ranger",
		body: "Open a pull request in our GitHub repo",
	},
	"request-racer": {
		name: "Request Racer",
		body: "Open 3 pull requests in our GitHub repo",
	},
	"request-robot": {
		name: "Request Robot",
		body: "Open 5 pull requests in our GitHub repo",
	},
	"request-rampage": {
		name: "Request Rampage",
		body: "Open 10 pull requests in our GitHub repo",
	},
	"rabid-requester": {
		name: "Rabid Requester",
		body: "Open 30 pull requests in our GitHub repo",
	},
};

function getAchievementDisplay(
	id: string,
	totalWordCount: number,
): AchievementDisplay | null {
	if (id === "words-words-words") {
		return {
			name: "Words words words",
			body: `Wrote ${totalWordCount.toLocaleString("en")} words!`,
		};
	}

	// Year-based contributor badges: "{year}-contributor"
	const yearMatch = /^(\d{4})-contributor$/.exec(id);
	if (yearMatch) {
		const year = yearMatch[1];
		return {
			name: `${year} Contributor`,
			body: `Make a commit to the site in ${year}!`,
		};
	}

	return FIXED_ACHIEVEMENT_DISPLAY[id] ?? null;
}

// ── Route ─────────────────────────────────────────────────────────────────────

const AuthorParamsSchema = Type.Object({
	slug: Type.String(),
});

const AchievementSchema = Type.Object({
	id: Type.String(),
	name: Type.String(),
	body: Type.String(),
});

const AuthorResponseSchema = Type.Object({
	id: Type.String(),
	name: Type.String(),
	description: Type.String(),
	profileImageUrl: Type.Optional(Type.String()),
	socials: Type.Record(Type.String(), Type.String()),
	roles: Type.Array(Type.String()),
	achievements: Type.Array(AchievementSchema),
});

type AuthorResponse = Static<typeof AuthorResponseSchema>;

const authorsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get<{
		Params: Static<typeof AuthorParamsSchema>;
		Reply: AuthorResponse | { error: string };
	}>(
		"/content/authors/:slug",
		{
			schema: {
				description: "Fetch an author profile with their earned achievements",
				params: AuthorParamsSchema,
				response: {
					200: {
						description: "Successful",
						content: {
							"application/json": { schema: AuthorResponseSchema },
						},
					},
				},
			},
		},
		async (request, reply) => {
			const { slug } = request.params;

			const profile = await db.query.profiles.findFirst({
				where: { slug },
				with: { achievements: true },
			});

			if (!profile) {
				reply.code(404);
				reply.send({ error: "Author not found" });
				return;
			}

			const meta = profile.meta as {
				socials?: Record<string, string>;
				roles?: string[];
			};

			// Only fetch total word count if the author has the words-words-words
			// achievement — avoids an unnecessary join for everyone else.
			const hasWordsAchievement = profile.achievements.some(
				(a) => a.achievementId === "words-words-words",
			);

			let totalWordCount = 0;
			if (hasWordsAchievement) {
				const wordCountResult = await db
					.select({ total: sum(postData.wordCount) })
					.from(postAuthors)
					.innerJoin(
						postData,
						and(
							eq(postData.slug, postAuthors.postSlug),
							eq(postData.locale, "en"),
						),
					)
					.where(eq(postAuthors.authorSlug, slug));
				totalWordCount = Number(wordCountResult[0]?.total ?? 0);
			}

			const achievements = profile.achievements
				.map((a) => {
					const display = getAchievementDisplay(
						a.achievementId,
						totalWordCount,
					);
					if (!display) return null;
					return { id: a.achievementId, ...display };
				})
				.filter((a): a is NonNullable<typeof a> => a !== null);

			const response: AuthorResponse = {
				id: profile.slug,
				name: profile.name,
				description: profile.description,
				profileImageUrl: profile.profileImage
					? createImageUrl(profile.profileImage)
					: undefined,
				socials: meta.socials ?? {},
				roles: meta.roles ?? [],
				achievements,
			};

			reply.code(200);
			reply.send(response);
		},
	);
};

export default authorsRoutes;
