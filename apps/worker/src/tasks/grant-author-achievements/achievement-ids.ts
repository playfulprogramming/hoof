export const MANUAL_ACHIEVEMENT_IDS = [
	"site-redesign",
	"site-logo",
	"code-challenge",
	"partner",
	"messages-200",
	"messages-500",
	"messages-1000",
] as const;

interface AchievementRuleInput {
	roles: string[];
	postCount: number;
	maxPostWordCount: number;
	totalWordCount: number;
	hasCoAuthoredPost: boolean;
	collectionCount: number;
	github?: {
		issueCount: number;
		pullRequestCount: number;
		commitsInYear: number[];
	};
}

interface AchievementRule {
	id: string;
	check: (input: AchievementRuleInput) => boolean;
}

const FIRST_CONTRIBUTOR_YEAR = 2019;

function contributorYears(): number[] {
	const years: number[] = [];
	for (let y = FIRST_CONTRIBUTOR_YEAR; y <= new Date().getFullYear(); y++) {
		years.push(y);
	}
	return years;
}

export const ACHIEVEMENT_RULES: AchievementRule[] = [
	// Role-based — role count tier (exclusive: only highest)
	{
		id: "badge-collector",
		check: ({ roles }) => roles.length >= 3,
	},
	{
		id: "hello-world",
		check: ({ roles }) => roles.length >= 1 && roles.length < 3,
	},
	// Role-based — specific roles (not exclusive with role count tier)
	{
		id: "localizer-9000",
		check: ({ roles }) => roles.includes("translator"),
	},
	{
		id: "community-crowned",
		check: ({ roles }) => roles.includes("community"),
	},
	// Content-based — post count tier (exclusive: only highest)
	{
		id: "cream-of-the-crop",
		check: ({ postCount }) => postCount >= 30,
	},
	{
		id: "post-palooza",
		check: ({ postCount }) => postCount >= 10 && postCount < 30,
	},
	{
		id: "profusely-posting",
		check: ({ postCount }) => postCount >= 5 && postCount < 10,
	},
	{
		id: "politely-posting",
		check: ({ postCount }) => postCount >= 3 && postCount < 5,
	},
	// Content-based — not exclusive
	{
		id: "words-words-words",
		check: ({ totalWordCount }) => totalWordCount > 0,
	},
	{
		id: "it-keeps-going",
		check: ({ maxPostWordCount }) => maxPostWordCount >= 6000,
	},
	{
		id: "team-player",
		check: ({ hasCoAuthoredPost }) => hasCoAuthoredPost,
	},
	{
		id: "collect-em-all",
		check: ({ collectionCount }) => collectionCount > 0,
	},
	// GitHub-based — issue count tier (exclusive: only highest)
	{
		id: "insect-infestation",
		check: ({ github }) => (github?.issueCount ?? 0) >= 25,
	},
	{
		id: "creepy-crawlies",
		check: ({ github }) =>
			(github?.issueCount ?? 0) >= 10 && (github?.issueCount ?? 0) < 25,
	},
	{
		id: "bug",
		check: ({ github }) =>
			(github?.issueCount ?? 0) >= 1 && (github?.issueCount ?? 0) < 10,
	},
	// GitHub-based — PR count tier (exclusive: only highest)
	{
		id: "rabid-requester",
		check: ({ github }) => (github?.pullRequestCount ?? 0) >= 30,
	},
	{
		id: "request-rampage",
		check: ({ github }) =>
			(github?.pullRequestCount ?? 0) >= 10 &&
			(github?.pullRequestCount ?? 0) < 30,
	},
	{
		id: "request-robot",
		check: ({ github }) =>
			(github?.pullRequestCount ?? 0) >= 5 &&
			(github?.pullRequestCount ?? 0) < 10,
	},
	{
		id: "request-racer",
		check: ({ github }) =>
			(github?.pullRequestCount ?? 0) >= 3 &&
			(github?.pullRequestCount ?? 0) < 5,
	},
	{
		id: "request-ranger",
		check: ({ github }) =>
			(github?.pullRequestCount ?? 0) >= 1 &&
			(github?.pullRequestCount ?? 0) < 3,
	},
	// GitHub-based — yearly commits (one per year, not exclusive)
	...contributorYears().map((year) => ({
		id: `${year}-contributor`,
		check: ({ github }: AchievementRuleInput) =>
			github?.commitsInYear.includes(year) ?? false,
	})),
];

export const ALL_POSSIBLE_AUTO_IDS: string[] = ACHIEVEMENT_RULES.map(
	(r) => r.id,
);
