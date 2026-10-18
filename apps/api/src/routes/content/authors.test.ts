import fastify, { type FastifyInstance } from "fastify";
import authorsRoutes from "./authors.ts";
import { db, authors, postAuthors, posts } from "@playfulprogramming/db";
import {
	and,
	asc,
	countDistinct,
	desc,
	eq,
	isNotNull,
	notInArray,
	or,
} from "drizzle-orm";
import { BRANCH_MAIN } from "@playfulprogramming/common";

const PR_BRANCH = "pull/42";

function createAuthorRow(overrides: Record<string, unknown> = {}) {
	return {
		slug: "crutchcorn",
		name: "Corbin Crutchley",
		description: "Project lead for Playful Programming.",
		profileImage: null,
		meta: {},
		achievements: [],
		...overrides,
	};
}

function mockSelectChain(rows: unknown[]) {
	const offset = vi.fn().mockResolvedValue(rows);
	const limit = vi.fn().mockReturnValue({ offset });
	const orderBy = vi.fn().mockReturnValue({ limit });
	const groupBy = vi.fn().mockReturnValue({ orderBy });
	const where = vi.fn().mockReturnValue({ groupBy });
	const leftJoinPosts = vi.fn().mockReturnValue({ where });
	const leftJoinPostAuthors = vi
		.fn()
		.mockReturnValue({ leftJoin: leftJoinPosts });
	const from = vi.fn().mockReturnValue({ leftJoin: leftJoinPostAuthors });

	vi.mocked(db.select).mockReturnValue({ from } as never);

	return {
		from,
		leftJoinPostAuthors,
		leftJoinPosts,
		where,
		groupBy,
		orderBy,
		limit,
		offset,
	};
}

describe("Authors Routes Tests", () => {
	let app: FastifyInstance;
	beforeAll(async () => {
		app = fastify();
		await app.register(authorsRoutes);
	});

	afterAll(async () => {
		await app.close();
	});

	describe("/content/authors", () => {
		test("returns all authors", async () => {
			mockSelectChain([
				{
					slug: "crutchcorn",
					name: "Corbin Crutchley",
					description: "Project lead for Playful Programming.",
					profileImage: "content/profile.png",
					postsCount: 3,
				},
				{
					slug: "fennifith",
					name: "James Fenn",
					description: "Backend lead for Playful Programming.",
					profileImage: null,
					postsCount: 0,
				},
			]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`
				[
				  {
				    "description": "Project lead for Playful Programming.",
				    "id": "crutchcorn",
				    "name": "Corbin Crutchley",
				    "posts": 3,
				    "profileImageUrl": "https://s3_public_url.test/s3_bucket/content/profile.png",
				  },
				  {
				    "description": "Backend lead for Playful Programming.",
				    "id": "fennifith",
				    "name": "James Fenn",
				    "posts": 0,
				  },
				]
			`);
		});

		test("returns an empty list when there are no authors", async () => {
			mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`[]`);
		});

		test("paginates using page and limit query params", async () => {
			const chain = mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "2", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.limit).toHaveBeenCalledWith(10);
			expect(chain.offset).toHaveBeenCalledWith(20);
		});

		test("defaults to sortBy=id, ordering by author slug ascending", async () => {
			const chain = mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.orderBy).toHaveBeenCalledWith(asc(authors.slug));
		});

		test("sortBy=posts orders authors by descending post count", async () => {
			const chain = mockSelectChain([
				{
					slug: "crutchcorn",
					name: "Corbin Crutchley",
					description: "Project lead for Playful Programming.",
					profileImage: null,
					postsCount: 10,
				},
				{
					slug: "fennifith",
					name: "James Fenn",
					description: "Backend lead for Playful Programming.",
					profileImage: null,
					postsCount: 4,
				},
			]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10", sortBy: "posts" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.orderBy).toHaveBeenCalledWith(
				desc(countDistinct(posts.slug)),
				asc(authors.slug),
			);
			expect(
				response.json().map((author: { id: string }) => author.id),
			).toEqual(["crutchcorn", "fennifith"]);
		});

		test("joins postAuthors on the author's slug", async () => {
			const chain = mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.leftJoinPostAuthors).toHaveBeenCalledWith(
				postAuthors,
				eq(postAuthors.authorSlug, authors.slug),
			);
		});

		test("only counts posts on the same branch with a publishedAt date and noindex false", async () => {
			const chain = mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.leftJoinPosts).toHaveBeenCalledWith(
				posts,
				and(
					eq(posts.id, postAuthors.postId),
					eq(posts.branch, BRANCH_MAIN),
					isNotNull(posts.publishedAt),
					eq(posts.noindex, false),
				),
			);
		});

		test("fetches the requested branch's author slugs and post slugs before the list query", async () => {
			mockSelectChain([]);
			vi.mocked(db.query.authors.findMany).mockResolvedValue([]);
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			expect(db.query.authors.findMany).toHaveBeenCalledExactlyOnceWith({
				columns: { slug: true },
				where: { branch: PR_BRANCH },
			});
			expect(db.query.posts.findMany).toHaveBeenCalledExactlyOnceWith({
				columns: { slug: true },
				where: { branch: PR_BRANCH },
			});
		});

		test("lists the requested branch's authors, or main's for slugs the branch does not have, and counts posts by the same rule", async () => {
			const chain = mockSelectChain([]);
			vi.mocked(db.query.authors.findMany).mockResolvedValue([
				{ slug: "crutchcorn" },
			] as never);
			vi.mocked(db.query.posts.findMany).mockResolvedValue([
				{ slug: "edited-post" },
				{ slug: "hidden-post" },
			] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.where).toHaveBeenCalledWith(
				or(
					eq(authors.branch, PR_BRANCH),
					and(
						eq(authors.branch, BRANCH_MAIN),
						notInArray(authors.slug, ["crutchcorn"]),
					),
				),
			);
			// The publishedAt and noindex filters sit next to the branch condition, so an
			// unpublished or noindex branch post is not replaced by main's published copy.
			expect(chain.leftJoinPosts).toHaveBeenCalledWith(
				posts,
				and(
					eq(posts.id, postAuthors.postId),
					or(
						eq(posts.branch, PR_BRANCH),
						and(
							eq(posts.branch, BRANCH_MAIN),
							notInArray(posts.slug, ["edited-post", "hidden-post"]),
						),
					),
					isNotNull(posts.publishedAt),
					eq(posts.noindex, false),
				),
			);
		});

		test("does not send an empty not-in list when the requested branch has no rows", async () => {
			const chain = mockSelectChain([]);
			vi.mocked(db.query.authors.findMany).mockResolvedValue([]);
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.where).toHaveBeenCalledWith(
				or(eq(authors.branch, PR_BRANCH), eq(authors.branch, BRANCH_MAIN)),
			);
			expect(chain.leftJoinPosts).toHaveBeenCalledWith(
				posts,
				and(
					eq(posts.id, postAuthors.postId),
					or(eq(posts.branch, PR_BRANCH), eq(posts.branch, BRANCH_MAIN)),
					isNotNull(posts.publishedAt),
					eq(posts.noindex, false),
				),
			);
		});

		test("defaults branch to BRANCH_MAIN and skips the branch slug queries", async () => {
			const chain = mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.where).toHaveBeenCalledWith(eq(authors.branch, BRANCH_MAIN));
			expect(db.query.authors.findMany).not.toHaveBeenCalled();
			expect(db.query.posts.findMany).not.toHaveBeenCalled();
		});
	});

	describe("/content/authors/:slug", () => {
		test("returns an author profile with their earned achievements", async () => {
			vi.mocked(db.query.authors.findFirst).mockResolvedValue({
				slug: "crutchcorn",
				name: "Corbin Crutchley",
				description: "Project lead for Playful Programming.",
				profileImage: "content/profile.png",
				meta: {
					socials: { twitter: "crutchcorn" },
					roles: ["lead"],
				},
				achievements: [
					{
						achievementId: "early-adopter",
						grantedAt: new Date("2024-01-15T00:00:00Z"),
					},
				],
			} as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors/crutchcorn",
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`
				{
				  "achievements": [
				    {
				      "grantedAt": "2024-01-15T00:00:00.000Z",
				      "id": "early-adopter",
				    },
				  ],
				  "description": "Project lead for Playful Programming.",
				  "id": "crutchcorn",
				  "name": "Corbin Crutchley",
				  "profileImageUrl": "https://s3_public_url.test/s3_bucket/content/profile.png",
				  "roles": [
				    "lead",
				  ],
				  "socials": {
				    "twitter": "crutchcorn",
				  },
				}
			`);
		});

		test("returns 404 when the author does not exist", async () => {
			vi.mocked(db.query.authors.findFirst).mockResolvedValue(undefined);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors/non-existent-author",
			});

			expect(response.statusCode).toBe(404);
			expect(response.json()).toMatchInlineSnapshot(`
				{
				  "error": "Author not found",
				}
			`);
		});

		test("returns the requested branch's author without looking main up", async () => {
			vi.mocked(db.query.authors.findFirst)
				.mockResolvedValue(undefined)
				.mockResolvedValueOnce(createAuthorRow({ name: "PR Name" }) as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors/crutchcorn",
				query: { branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().name).toBe("PR Name");
			expect(db.query.authors.findFirst).toHaveBeenCalledExactlyOnceWith({
				where: { slug: "crutchcorn", branch: PR_BRANCH },
				with: { achievements: true },
			});
		});

		test("falls back to main's author when the requested branch has no row", async () => {
			vi.mocked(db.query.authors.findFirst)
				.mockResolvedValue(undefined)
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce(createAuthorRow({ name: "Main Name" }) as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors/crutchcorn",
				query: { branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().name).toBe("Main Name");
			expect(db.query.authors.findFirst).toHaveBeenCalledTimes(2);
			expect(db.query.authors.findFirst).toHaveBeenNthCalledWith(1, {
				where: { slug: "crutchcorn", branch: PR_BRANCH },
				with: { achievements: true },
			});
			expect(db.query.authors.findFirst).toHaveBeenNthCalledWith(2, {
				where: { slug: "crutchcorn", branch: BRANCH_MAIN },
				with: { achievements: true },
			});
		});

		test("returns 404 when neither the requested branch nor main has the author", async () => {
			vi.mocked(db.query.authors.findFirst).mockResolvedValue(undefined);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors/crutchcorn",
				query: { branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(404);
			expect(db.query.authors.findFirst).toHaveBeenCalledTimes(2);
		});

		test("defaults branch to BRANCH_MAIN and does not look main up a second time", async () => {
			vi.mocked(db.query.authors.findFirst).mockResolvedValue(undefined);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors/crutchcorn",
			});

			expect(response.statusCode).toBe(404);
			expect(db.query.authors.findFirst).toHaveBeenCalledExactlyOnceWith({
				where: { slug: "crutchcorn", branch: BRANCH_MAIN },
				with: { achievements: true },
			});
		});
	});
});
