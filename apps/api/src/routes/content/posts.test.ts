import fastify, { type FastifyInstance } from "fastify";
import postsRoutes from "./posts.ts";
import { db } from "@playfulprogramming/db";

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
							name: "Corbin Crutchley",
							profileImage: null,
						},
						{
							slug: "fennifith",
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
	});
});
