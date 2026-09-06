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
				versions: [],
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
				  "versions": [],
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
				versions: [],
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
				  "versions": [],
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
				versions: [],
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
				  "versions": [],
				  "wordCount": 300,
				}
			`);
		});

		test("includes the current post in the versions list, in the order returned by the query", async () => {
			vi.mocked(db.query.posts.findFirst).mockResolvedValue({
				slug: "example-post",
				title: "Example Post",
				description: "A post with multiple versions",
				bannerImage: null,
				socialImage: null,
				wordCount: 400,
				publishedAt: new Date("2024-01-15T00:00:00Z"),
				authors: [],
				collection: null,
				versions: [
					{
						slug: "example-post",
						versionName: "",
						publishedAt: new Date("2024-01-15T00:00:00Z"),
					},
					{
						slug: "example-post-v2-earlier",
						versionName: "v2",
						publishedAt: new Date("2024-03-01T00:00:00Z"),
					},
					{
						slug: "example-post-v2-later",
						versionName: "v2",
						publishedAt: new Date("2024-04-01T00:00:00Z"),
					},
					{
						slug: "example-post-v3",
						versionName: "v3",
						publishedAt: new Date("2024-06-01T00:00:00Z"),
					},
				],
			} as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/example-post",
				query: { locale: "en" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().versions).toMatchInlineSnapshot(`
				[
				  {
				    "publishedAt": "2024-01-15T00:00:00.000Z",
				    "slug": "example-post",
				    "versionName": "",
				  },
				  {
				    "publishedAt": "2024-03-01T00:00:00.000Z",
				    "slug": "example-post-v2-earlier",
				    "versionName": "v2",
				  },
				  {
				    "publishedAt": "2024-04-01T00:00:00.000Z",
				    "slug": "example-post-v2-later",
				    "versionName": "v2",
				  },
				  {
				    "publishedAt": "2024-06-01T00:00:00.000Z",
				    "slug": "example-post-v3",
				    "versionName": "v3",
				  },
				]
			`);
		});

		test("returns an empty versions array when the post has no groupId", async () => {
			vi.mocked(db.query.posts.findFirst).mockResolvedValue({
				slug: "standalone-post",
				title: "Standalone Post",
				description: "A post with no other versions",
				bannerImage: null,
				socialImage: null,
				wordCount: 200,
				publishedAt: new Date("2024-01-15T00:00:00Z"),
				authors: [],
				collection: null,
				versions: [],
			} as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/standalone-post",
				query: { locale: "en" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().versions).toMatchInlineSnapshot(`[]`);
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
	});
});
