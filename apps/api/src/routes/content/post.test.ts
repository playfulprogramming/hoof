import fastify, { type FastifyInstance } from "fastify";
import postRoutes from "./post.ts";
import { db } from "@playfulprogramming/db";

describe("Post Routes Tests", () => {
	let app: FastifyInstance;
	beforeAll(async () => {
		app = fastify();
		await app.register(postRoutes);
	});

	afterAll(async () => {
		await app.close();
	});

	describe("/content/post/:slug", () => {
		test("returns a post with its authors and a chapter list sorted by collectionOrder", async () => {
			vi.mocked(db.query.posts.findFirst).mockResolvedValue({
				slug: "chapter-two",
				title: "Chapter Two",
				description: "The second chapter",
				bannerImage: "content/banner.png",
				socialImage: "content/social.png",
				wordCount: 500,
				publishedAt: new Date("2024-01-15T00:00:00Z"),
				authors: [
					{
						slug: "crutchcorn",
						name: "Corbin Crutchley",
						profileImage: "content/profile.png",
					},
				],
				collection: {
					slug: "example-collection",
					data: [{ title: "Example Collection" }],
					posts: [
						{
							slug: "chapter-two",
							collectionOrder: 1,
							title: "Chapter Two",
						},
						{
							slug: "chapter-one",
							collectionOrder: 0,
							title: "Chapter One",
						},
					],
				},
			} as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/chapter-two",
				query: { locale: "en" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`
				{
				  "authors": [
				    {
				      "id": "crutchcorn",
				      "name": "Corbin Crutchley",
				      "profileImageUrl": "https://s3_public_url.test/s3_bucket/content/profile.png",
				    },
				  ],
				  "bannerUrl": "https://s3_public_url.test/s3_bucket/content/banner.png",
				  "collection": {
				    "chapters": [
				      {
				        "slug": "chapter-one",
				        "title": "Chapter One",
				      },
				      {
				        "slug": "chapter-two",
				        "title": "Chapter Two",
				      },
				    ],
				    "slug": "example-collection",
				    "title": "Example Collection",
				  },
				  "description": "The second chapter",
				  "publishedAt": "2024-01-15T00:00:00.000Z",
				  "slug": "chapter-two",
				  "socialImageUrl": "https://s3_public_url.test/s3_bucket/content/social.png",
				  "title": "Chapter Two",
				  "wordCount": 500,
				}
			`);
		});

		test("omits collection when the post is not part of a collection", async () => {
			vi.mocked(db.query.posts.findFirst).mockResolvedValue({
				slug: "standalone-post",
				title: "Standalone Post",
				description: "A post with no collection",
				bannerImage: null,
				socialImage: null,
				wordCount: 200,
				publishedAt: new Date("2024-01-15T00:00:00Z"),
				authors: [
					{ slug: "crutchcorn", name: "Corbin Crutchley", profileImage: null },
				],
				collection: null,
			} as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/standalone-post",
				query: { locale: "en" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`
				{
				  "authors": [
				    {
				      "id": "crutchcorn",
				      "name": "Corbin Crutchley",
				    },
				  ],
				  "description": "A post with no collection",
				  "publishedAt": "2024-01-15T00:00:00.000Z",
				  "slug": "standalone-post",
				  "title": "Standalone Post",
				  "wordCount": 200,
				}
			`);
		});

		test("returns 404 when the requested post is unpublished for the locale", async () => {
			vi.mocked(db.query.posts.findFirst).mockResolvedValue({
				slug: "draft-post",
				title: "Draft Post",
				description: "Not yet published",
				bannerImage: null,
				socialImage: null,
				wordCount: 100,
				publishedAt: null,
				authors: [],
				collection: null,
			} as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/draft-post",
				query: { locale: "en" },
			});

			expect(response.statusCode).toBe(404);
			expect(response.json()).toMatchInlineSnapshot(`
				{
				  "error": "Post not found",
				}
			`);
		});

		test("excludes unpublished sibling chapters from the chapter list", async () => {
			vi.mocked(db.query.posts.findFirst).mockResolvedValue({
				slug: "chapter-one",
				title: "Chapter One",
				description: "The first chapter",
				bannerImage: null,
				socialImage: null,
				wordCount: 300,
				publishedAt: new Date("2024-01-15T00:00:00Z"),
				authors: [],
				collection: {
					slug: "example-collection",
					data: [{ title: "Example Collection" }],
					posts: [
						{
							slug: "chapter-one",
							collectionOrder: 0,
							title: "Chapter One",
							publishedAt: new Date("2024-01-15T00:00:00Z"),
						},
						{
							slug: "chapter-two-draft",
							collectionOrder: 1,
							title: "Chapter Two (Draft)",
							publishedAt: null,
						},
						{
							slug: "chapter-three",
							collectionOrder: 2,
							title: "Chapter Three",
							publishedAt: new Date("2024-01-20T00:00:00Z"),
						},
					],
				},
			} as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/chapter-one",
				query: { locale: "en" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`
				{
				  "authors": [],
				  "collection": {
				    "chapters": [
				      {
				        "slug": "chapter-one",
				        "title": "Chapter One",
				      },
				      {
				        "slug": "chapter-three",
				        "title": "Chapter Three",
				      },
				    ],
				    "slug": "example-collection",
				    "title": "Example Collection",
				  },
				  "description": "The first chapter",
				  "publishedAt": "2024-01-15T00:00:00.000Z",
				  "slug": "chapter-one",
				  "title": "Chapter One",
				  "wordCount": 300,
				}
			`);
		});

		test("returns 404 when the post does not exist", async () => {
			vi.mocked(db.query.posts.findFirst).mockResolvedValue(undefined);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/non-existent-post",
				query: { locale: "en" },
			});

			expect(response.statusCode).toBe(404);
			expect(response.json()).toMatchInlineSnapshot(`
				{
				  "error": "Post not found",
				}
			`);
		});

		test("returns 404 when the post does not exist", async () => {
			vi.mocked(db.query.posts.findFirst).mockResolvedValue(undefined as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/spanish-only-post",
				query: { locale: "en" },
			});

			expect(response.statusCode).toBe(404);
			expect(response.json()).toMatchInlineSnapshot(`
				{
				  "error": "Post not found",
				}
			`);
		});
	});
});
