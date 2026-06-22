import { client } from "./client.ts";
import { env } from "@playfulprogramming/common";

export interface AuthorGitHubStats {
	issueCount: number;
	pullRequestCount: number;
	commitsInYear: number[];
}

const FIRST_CONTRIBUTOR_YEAR = 2019;

function contributorYears(): number[] {
	const years: number[] = [];
	for (let y = FIRST_CONTRIBUTOR_YEAR; y <= new Date().getFullYear(); y++) {
		years.push(y);
	}
	return years;
}

const years = contributorYears();

// Mirrors the GraphQL query used in the playfulprogramming frontend at build time.
// Fetches total issues opened, PRs opened, and which calendar years had ≥1 commit.
const statsQuery = `
query($login: String, $id: ID, $prSearch: String!) {
  repository(owner: "${env.GITHUB_REPO_OWNER}", name: "${env.GITHUB_REPO_NAME}") {
    defaultBranchRef {
      target {
        ... on Commit {
          ${years
						.map(
							(year) => `
          history${year}: history(
            first: 1
            since: "${year}-01-01T00:00:00.000Z"
            until: "${year + 1}-01-01T00:00:00.000Z"
            author: { id: $id }
          ) { totalCount }`,
						)
						.join("")}
        }
      }
    }
    issues(filterBy: { createdBy: $login }) { totalCount }
  }
  search(query: $prSearch, type: ISSUE) { issueCount }
}
`;

type StatsResponse = {
	repository: {
		defaultBranchRef: {
			target: Record<string, { totalCount: number }>;
		};
		issues: { totalCount: number };
	};
	search: { issueCount: number };
};

export async function getAuthorGitHubStats(
	githubLogin: string,
): Promise<AuthorGitHubStats | undefined> {
	if (!env.GITHUB_TOKEN) return undefined;

	const userResult = (await client.graphql<Record<string, { id: string }>>(
		`query { user(login: "${githubLogin}") { id } }`,
	)) as Record<string, { id: string }>;

	const userId = userResult?.user?.id;
	if (!userId) return undefined;

	const response = await client.graphql<StatsResponse>(statsQuery, {
		login: githubLogin,
		id: userId,
		prSearch: `repo:${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME} is:pr author:${githubLogin}`,
	});

	const commitTarget = response.repository.defaultBranchRef.target;
	const commitsInYear = years.filter(
		(year) => (commitTarget[`history${year}`]?.totalCount ?? 0) > 0,
	);

	return {
		issueCount: response.repository.issues.totalCount,
		pullRequestCount: response.search.issueCount,
		commitsInYear,
	};
}
