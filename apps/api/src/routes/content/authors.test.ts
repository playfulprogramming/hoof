import fastify, { type FastifyInstance } from "fastify";
import authorsRoutes from "./authors.ts";
import { db, authors, postAuthors, posts } from "@playfulprogramming/db";
import { and, asc, countDistinct, desc, eq, isNotNull } from "drizzle-orm";
import { BRANCH_MAIN } from "@playfulprogramming/common";

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

		test("filters authors to the requested branch, including the post count join", async () => {
			const chain = mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10", branch: "pull/42" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.where).toHaveBeenCalledWith(eq(authors.branch, "pull/42"));
			expect(chain.leftJoinPosts).toHaveBeenCalledWith(
				posts,
				and(
					eq(posts.id, postAuthors.postId),
					eq(posts.branch, "pull/42"),
					isNotNull(posts.publishedAt),
					eq(posts.noindex, false),
				),
			);
		});

		test("defaults branch to BRANCH_MAIN when not provided", async () => {
			const chain = mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/authors",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.where).toHaveBeenCalledWith(eq(authors.branch, BRANCH_MAIN));
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

		test("passes the requested branch through to the query", async () => {
			vi.mocked(db.query.authors.findFirst).mockResolvedValue(undefined);

			await app.inject({
				method: "GET",
				url: "/content/authors/crutchcorn",
				query: { branch: "pull/42" },
			});

			expect(db.query.authors.findFirst).toHaveBeenCalledWith({
				where: { slug: "crutchcorn", branch: "pull/42" },
				with: { achievements: true },
			});
		});

		test("defaults branch to BRANCH_MAIN when not provided", async () => {
			vi.mocked(db.query.authors.findFirst).mockResolvedValue(undefined);

			await app.inject({
				method: "GET",
				url: "/content/authors/crutchcorn",
			});

			expect(db.query.authors.findFirst).toHaveBeenCalledWith({
				where: { slug: "crutchcorn", branch: BRANCH_MAIN },
				with: { achievements: true },
			});
		});
	});
});
