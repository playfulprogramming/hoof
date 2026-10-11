import fastify, { type FastifyInstance } from "fastify";
import postsRoutes from "./posts.ts";
import { db } from "@playfulprogramming/db";
import { BRANCH_MAIN } from "@playfulprogramming/common";

const PR_BRANCH = "pull/42";

describe("Posts Routes Tests", () => {
	let app: FastifyInstance;
	beforeAll(async () => {
		app = fastify();
		await app.register(postsRoutes);
	});

	afterAll(async () => {
		await app.close();
	});

	describe("/content/posts", () => {
		test("returns posts with their authors and tags", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([
				{
					slug: "example-post",
					title: "Example Post",
					bannerImage: "content/banner.png",
					wordCount: 1200,
					publishedAt: new Date("2024-01-15T00:00:00Z"),
					authors: [
						{
							slug: "crutchcorn",
							branch: BRANCH_MAIN,
							name: "Corbin Crutchley",
							profileImage: "content/profile.png",
						},
					],
					tags: [{ tag: "react" }, { tag: "javascript" }],
				},
			] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`
				[
				  {
				    "authors": [
				      {
				        "id": "crutchcorn",
				        "name": "Corbin Crutchley",
				        "profileImageUrl": "https://s3_public_url.test/s3_bucket/content/profile.png",
				      },
				    ],
				    "bannerUrl": "https://s3_public_url.test/s3_bucket/content/banner.png",
				    "publishedAt": "2024-01-15T00:00:00.000Z",
				    "slug": "example-post",
				    "tags": [
				      "react",
				      "javascript",
				    ],
				    "title": "Example Post",
				    "wordCount": 1200,
				  },
				]
			`);
		});

		test("does not include a description or excerpt field", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([
				{
					slug: "example-post",
					title: "Example Post",
					bannerImage: null,
					wordCount: 300,
					publishedAt: new Date("2024-01-15T00:00:00Z"),
					authors: [],
					tags: [],
				},
			] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			const [post] = response.json();
			expect(post).not.toHaveProperty("description");
			expect(post).not.toHaveProperty("excerpt");
		});

		test("groups multiple co-authors under the same post", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([
				{
					slug: "example-post",
					title: "Example Post",
					bannerImage: null,
					wordCount: 300,
					publishedAt: new Date("2024-01-15T00:00:00Z"),
					authors: [
						{
							slug: "crutchcorn",
							branch: BRANCH_MAIN,
							name: "Corbin Crutchley",
							profileImage: null,
						},
						{
							slug: "fennifith",
							branch: BRANCH_MAIN,
							name: "James Fenn",
							profileImage: null,
						},
					],
					tags: [],
				},
			] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(
				response.json()[0].authors.map((a: { id: string }) => a.id),
			).toEqual(["crutchcorn", "fennifith"]);
		});

		test("returns an empty list when there are no posts", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`[]`);
		});

		test("paginates using page and limit query params", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "2", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(db.query.posts.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					limit: 10,
					offset: 20,
				}),
			);
		});

		test("defaults to sort=newest, ordering by publishedAt descending", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(db.query.posts.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: { publishedAt: "desc" },
				}),
			);
		});

		test("sort=oldest orders by publishedAt ascending", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10", sort: "oldest" },
			});

			expect(response.statusCode).toBe(200);
			expect(db.query.posts.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: { publishedAt: "asc" },
				}),
			);
		});

		test("only includes posts with a publishedAt date and noindex false", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(db.query.posts.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						publishedAt: { isNotNull: true },
						noindex: false,
					}),
				}),
			);
		});

		test("author filter adds an EXISTS clause matching co-authors, not just a primary author", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10", author: "crutchcorn" },
			});

			expect(response.statusCode).toBe(200);
			expect(db.query.posts.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						RAW: expect.any(Function),
					}),
				}),
			);
		});

		test("returns an empty list for an author with no posts", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10", author: "non-existent-author" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`[]`);
		});

		test("defaults branch to BRANCH_MAIN and skips the branch slug query", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10" },
			});

			expect(db.query.posts.findMany).toHaveBeenCalledTimes(1);
			expect(db.query.posts.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ branch: BRANCH_MAIN }),
					with: expect.objectContaining({
						authors: expect.objectContaining({
							where: { branch: { in: [BRANCH_MAIN] } },
						}),
					}),
				}),
			);
			expect(db.query.posts.findMany).not.toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ OR: expect.anything() }),
				}),
			);
		});

		test("fetches the requested branch's slugs for the locale without publish or noindex filters", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10", branch: PR_BRANCH, locale: "es" },
			});

			expect(db.query.posts.findMany).toHaveBeenCalledTimes(2);
			expect(db.query.posts.findMany).toHaveBeenNthCalledWith(1, {
				columns: { slug: true },
				where: { locale: "es", branch: PR_BRANCH },
			});
		});

		test("lists the requested branch's rows, or main's rows for slugs the branch does not have", async () => {
			vi.mocked(db.query.posts.findMany)
				.mockResolvedValue([])
				.mockResolvedValueOnce([
					{ slug: "edited-post" },
					{ slug: "hidden-post" },
				] as never);

			await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "1", limit: "10", branch: PR_BRANCH },
			});

			expect(db.query.posts.findMany).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					where: expect.objectContaining({
						locale: "en",
						OR: [
							{ branch: PR_BRANCH },
							{
								branch: BRANCH_MAIN,
								slug: { notIn: ["edited-post", "hidden-post"] },
							},
						],
					}),
					with: expect.objectContaining({
						authors: expect.objectContaining({
							where: { branch: { in: [PR_BRANCH, BRANCH_MAIN] } },
						}),
					}),
					limit: 10,
					offset: 10,
				}),
			);
			expect(db.query.posts.findMany).not.toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					where: expect.objectContaining({ branch: expect.anything() }),
				}),
			);
		});

		test("keeps the publishedAt and noindex filters next to the branch condition, so an unpublished or noindex branch row is not replaced by main's", async () => {
			vi.mocked(db.query.posts.findMany)
				.mockResolvedValue([])
				.mockResolvedValueOnce([{ slug: "hidden-post" }] as never);

			await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10", branch: PR_BRANCH },
			});

			expect(db.query.posts.findMany).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					where: expect.objectContaining({
						publishedAt: { isNotNull: true },
						noindex: false,
						OR: [
							{ branch: PR_BRANCH },
							{ branch: BRANCH_MAIN, slug: { notIn: ["hidden-post"] } },
						],
					}),
				}),
			);
		});

		test("does not send an empty not-in list when the requested branch has no rows", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10", branch: PR_BRANCH },
			});

			expect(db.query.posts.findMany).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					where: expect.objectContaining({
						OR: [{ branch: PR_BRANCH }, { branch: BRANCH_MAIN }],
					}),
				}),
			);
		});

		test("returns rows from the requested branch and from main, preferring the requested branch's author row", async () => {
			vi.mocked(db.query.posts.findMany)
				.mockResolvedValue([])
				.mockResolvedValueOnce([{ slug: "edited-post" }] as never)
				.mockResolvedValueOnce([
					{
						slug: "edited-post",
						title: "Edited On The PR",
						bannerImage: null,
						wordCount: 300,
						publishedAt: new Date("2024-02-01T00:00:00Z"),
						authors: [
							{
								slug: "crutchcorn",
								branch: BRANCH_MAIN,
								name: "Main Name",
								profileImage: null,
							},
							{
								slug: "crutchcorn",
								branch: PR_BRANCH,
								name: "PR Name",
								profileImage: null,
							},
						],
						tags: [],
					},
					{
						slug: "main-only-post",
						title: "Only On Main",
						bannerImage: null,
						wordCount: 200,
						publishedAt: new Date("2024-01-15T00:00:00Z"),
						authors: [
							{
								slug: "fennifith",
								branch: BRANCH_MAIN,
								name: "James Fenn",
								profileImage: null,
							},
							{
								slug: "fennifith",
								branch: "pull/7",
								name: "Other Branch Name",
								profileImage: null,
							},
						],
						tags: [],
					},
				] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			expect(
				response
					.json()
					.map((post: { slug: string; authors: unknown[] }) => [
						post.slug,
						post.authors,
					]),
			).toEqual([
				["edited-post", [{ id: "crutchcorn", name: "PR Name" }]],
				["main-only-post", [{ id: "fennifith", name: "James Fenn" }]],
			]);
		});
	});
});
