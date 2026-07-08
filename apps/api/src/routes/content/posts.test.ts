import fastify, { type FastifyInstance } from "fastify";
import postsRoutes from "./posts.ts";
import { db, postAuthors, postData, posts } from "@playfulprogramming/db";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";

function mockPostsSelectChain(rows: unknown[]) {
	const offset = vi.fn().mockResolvedValue(rows);
	const limit = vi.fn().mockReturnValue({ offset });
	const orderBy = vi.fn().mockReturnValue({ limit });
	const groupBy = vi.fn().mockReturnValue({ orderBy });
	const where = vi.fn().mockReturnValue({ groupBy });
	const leftJoinPostTags = vi.fn().mockReturnValue({ where });
	const innerJoinPostData = vi
		.fn()
		.mockReturnValue({ leftJoin: leftJoinPostTags });
	const from = vi.fn().mockReturnValue({ innerJoin: innerJoinPostData });

	return {
		from,
		innerJoinPostData,
		leftJoinPostTags,
		where,
		groupBy,
		orderBy,
		limit,
		offset,
	};
}

function mockAuthorsSelectChain(rows: unknown[]) {
	const where = vi.fn().mockResolvedValue(rows);
	const innerJoin = vi.fn().mockReturnValue({ where });
	const from = vi.fn().mockReturnValue({ innerJoin });

	return { from, innerJoin, where };
}

function mockDbSelect(postsRows: unknown[], authorRows: unknown[] = []) {
	const postsChain = mockPostsSelectChain(postsRows);
	const authorsChain = mockAuthorsSelectChain(authorRows);

	const selectMock = vi.mocked(db.select);
	selectMock.mockReturnValueOnce({ from: postsChain.from } as never);
	if (postsRows.length > 0) {
		selectMock.mockReturnValueOnce({ from: authorsChain.from } as never);
	}

	return { postsChain, authorsChain };
}

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
			mockDbSelect(
				[
					{
						slug: "example-post",
						title: "Example Post",
						bannerImage: "content/banner.png",
						wordCount: 1200,
						publishedAt: new Date("2024-01-15T00:00:00Z"),
						tags: ["react", "javascript"],
					},
				],
				[
					{
						postSlug: "example-post",
						id: "crutchcorn",
						name: "Corbin Crutchley",
						profileImage: "content/profile.png",
					},
				],
			);

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
			mockDbSelect([
				{
					slug: "example-post",
					title: "Example Post",
					bannerImage: null,
					wordCount: 300,
					publishedAt: new Date("2024-01-15T00:00:00Z"),
					tags: [],
				},
			]);

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
			mockDbSelect(
				[
					{
						slug: "example-post",
						title: "Example Post",
						bannerImage: null,
						wordCount: 300,
						publishedAt: new Date("2024-01-15T00:00:00Z"),
						tags: [],
					},
				],
				[
					{
						postSlug: "example-post",
						id: "crutchcorn",
						name: "Corbin Crutchley",
						profileImage: null,
					},
					{
						postSlug: "example-post",
						id: "fennifith",
						name: "James Fenn",
						profileImage: null,
					},
				],
			);

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
			mockDbSelect([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`[]`);
		});

		test("paginates using page and limit query params", async () => {
			const { postsChain } = mockDbSelect([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "2", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(postsChain.limit).toBeCalledWith(10);
			expect(postsChain.offset).toBeCalledWith(20);
		});

		test("defaults to sort=newest, ordering by publishedAt descending", async () => {
			const { postsChain } = mockDbSelect([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(postsChain.orderBy).toBeCalledWith(desc(postData.publishedAt));
		});

		test("sort=oldest orders by publishedAt ascending", async () => {
			const { postsChain } = mockDbSelect([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10", sort: "oldest" },
			});

			expect(response.statusCode).toBe(200);
			expect(postsChain.orderBy).toBeCalledWith(asc(postData.publishedAt));
		});

		test("only includes posts with a publishedAt date and noindex false", async () => {
			const { postsChain } = mockDbSelect([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(postsChain.where).toBeCalledWith(
				and(isNotNull(postData.publishedAt), eq(postData.noindex, false)),
			);
		});

		test("author filter adds an EXISTS clause matching co-authors, not just a primary author", async () => {
			const { postsChain } = mockDbSelect([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/posts",
				query: { page: "0", limit: "10", author: "crutchcorn" },
			});

			expect(response.statusCode).toBe(200);
			expect(postsChain.where).toBeCalledWith(
				and(
					isNotNull(postData.publishedAt),
					eq(postData.noindex, false),
					sql`exists (select 1 from ${postAuthors} where ${postAuthors.postSlug} = ${posts.slug} and ${postAuthors.authorSlug} = ${"crutchcorn"})`,
				),
			);
		});

		test("returns an empty list for an author with no posts", async () => {
			mockDbSelect([]);

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
