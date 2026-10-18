import fastify, { type FastifyInstance } from "fastify";
import postRoutes from "./post.ts";
import { db } from "@playfulprogramming/db";
import { BRANCH_MAIN } from "@playfulprogramming/common";

const PR_BRANCH = "pull/42";

function createPostRow(overrides: Record<string, unknown> = {}) {
	return {
		slug: "example-post",
		title: "Example Post",
		description: "An example post",
		bannerImage: null,
		socialImage: null,
		wordCount: 100,
		publishedAt: new Date("2024-01-15T00:00:00Z"),
		authors: [],
		collections: [],
		versions: [],
		...overrides,
	};
}

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
		test("returns a post with its authors and a chapter list", async () => {
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
						branch: BRANCH_MAIN,
						name: "Corbin Crutchley",
						profileImage: "content/profile.png",
					},
				],
				collections: [
					{
						slug: "example-collection",
						branch: BRANCH_MAIN,
						title: "Example Collection",
						posts: [
							{
								slug: "chapter-one",
								title: "Chapter One",
							},
							{
								slug: "chapter-two",
								title: "Chapter Two",
							},
						],
					},
				],
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
					{
						slug: "crutchcorn",
						branch: BRANCH_MAIN,
						name: "Corbin Crutchley",
						profileImage: null,
					},
				],
				collections: [],
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
				collections: [],
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
				collections: [],
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
				collections: [],
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

		test("looks up the post on the requested branch and resolves related rows against that branch first", async () => {
			vi.mocked(db.query.posts.findFirst).mockResolvedValue(undefined);
			vi.mocked(db.query.posts.findMany).mockResolvedValue([
				{ slug: "edited-post" },
				{ slug: "moved-post" },
			] as never);

			await app.inject({
				method: "GET",
				url: "/content/post/example-post",
				query: { locale: "en", branch: PR_BRANCH },
			});

			// Every post slug on the branch for the locale, with no publish or noindex filter.
			expect(db.query.posts.findMany).toHaveBeenCalledExactlyOnceWith({
				columns: { slug: true },
				where: { locale: "en", branch: PR_BRANCH },
			});

			const relatedBranches = { in: [PR_BRANCH, BRANCH_MAIN] };
			const relatedPosts = {
				locale: "en",
				OR: [
					{ branch: PR_BRANCH },
					{
						branch: BRANCH_MAIN,
						slug: { notIn: ["edited-post", "moved-post"] },
					},
				],
				publishedAt: { isNotNull: true },
			};
			expect(db.query.posts.findFirst).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					where: { slug: "example-post", locale: "en", branch: PR_BRANCH },
					with: expect.objectContaining({
						authors: expect.objectContaining({
							where: { branch: relatedBranches },
						}),
						collections: expect.objectContaining({
							where: { locale: "en", branch: relatedBranches },
							with: {
								posts: expect.objectContaining({ where: relatedPosts }),
							},
						}),
						versions: expect.objectContaining({ where: relatedPosts }),
					}),
				}),
			);
		});

		test("defaults branch to BRANCH_MAIN, skips the branch slug query, and does not look main up a second time", async () => {
			vi.mocked(db.query.posts.findFirst).mockResolvedValue(undefined);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/example-post",
				query: { locale: "en" },
			});

			const relatedPosts = {
				locale: "en",
				branch: BRANCH_MAIN,
				publishedAt: { isNotNull: true },
			};
			expect(response.statusCode).toBe(404);
			expect(db.query.posts.findMany).not.toHaveBeenCalled();
			expect(db.query.posts.findFirst).toHaveBeenCalledTimes(1);
			expect(db.query.posts.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { slug: "example-post", locale: "en", branch: BRANCH_MAIN },
					with: expect.objectContaining({
						authors: expect.objectContaining({
							where: { branch: { in: [BRANCH_MAIN] } },
						}),
						collections: expect.objectContaining({
							with: {
								posts: expect.objectContaining({ where: relatedPosts }),
							},
						}),
						versions: expect.objectContaining({ where: relatedPosts }),
					}),
				}),
			);
		});

		test("returns the requested branch's post without looking main up", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);
			vi.mocked(db.query.posts.findFirst)
				.mockResolvedValue(undefined)
				.mockResolvedValueOnce(createPostRow({ title: "PR Title" }) as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/example-post",
				query: { locale: "en", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().title).toBe("PR Title");
			expect(db.query.posts.findFirst).toHaveBeenCalledTimes(1);
		});

		test("falls back to main's post when the requested branch has no row, still resolving related rows against the requested branch", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([
				{ slug: "moved-post" },
			] as never);
			vi.mocked(db.query.posts.findFirst)
				.mockResolvedValue(undefined)
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce(createPostRow({ title: "Main Title" }) as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/example-post",
				query: { locale: "en", branch: PR_BRANCH },
			});

			const relatedPosts = {
				locale: "en",
				OR: [
					{ branch: PR_BRANCH },
					{ branch: BRANCH_MAIN, slug: { notIn: ["moved-post"] } },
				],
				publishedAt: { isNotNull: true },
			};
			expect(response.statusCode).toBe(200);
			expect(response.json().title).toBe("Main Title");
			expect(db.query.posts.findMany).toHaveBeenCalledTimes(1);
			expect(db.query.posts.findFirst).toHaveBeenCalledTimes(2);
			expect(db.query.posts.findFirst).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					where: { slug: "example-post", locale: "en", branch: BRANCH_MAIN },
					with: expect.objectContaining({
						authors: expect.objectContaining({
							where: { branch: { in: [PR_BRANCH, BRANCH_MAIN] } },
						}),
						collections: expect.objectContaining({
							where: { locale: "en", branch: { in: [PR_BRANCH, BRANCH_MAIN] } },
							with: {
								posts: expect.objectContaining({ where: relatedPosts }),
							},
						}),
						versions: expect.objectContaining({ where: relatedPosts }),
					}),
				}),
			);
		});

		test("returns 404 when neither the requested branch nor main has the post", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);
			vi.mocked(db.query.posts.findFirst).mockResolvedValue(undefined);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/example-post",
				query: { locale: "en", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(404);
			expect(db.query.posts.findFirst).toHaveBeenCalledTimes(2);
		});

		test("returns 404 without falling back to main when the requested branch's post is unpublished", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([
				{ slug: "example-post" },
			] as never);
			vi.mocked(db.query.posts.findFirst)
				.mockResolvedValue(createPostRow({ title: "Main Title" }) as never)
				.mockResolvedValueOnce(createPostRow({ publishedAt: null }) as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/example-post",
				query: { locale: "en", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(404);
			expect(db.query.posts.findFirst).toHaveBeenCalledTimes(1);
		});

		test("does not send an empty not-in list for chapters and versions when the requested branch has no posts", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);
			vi.mocked(db.query.posts.findFirst).mockResolvedValue(undefined);

			await app.inject({
				method: "GET",
				url: "/content/post/example-post",
				query: { locale: "en", branch: PR_BRANCH },
			});

			const relatedPosts = {
				locale: "en",
				OR: [{ branch: PR_BRANCH }, { branch: BRANCH_MAIN }],
				publishedAt: { isNotNull: true },
			};
			expect(db.query.posts.findFirst).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					with: expect.objectContaining({
						collections: expect.objectContaining({
							with: {
								posts: expect.objectContaining({ where: relatedPosts }),
							},
						}),
						versions: expect.objectContaining({ where: relatedPosts }),
					}),
				}),
			);
		});

		test("excludes main's copy of a post the requested branch moved out of the collection or unpublished", async () => {
			// The branch has rows for both slugs, so main's copies are excluded by slug
			// even though the branch's rows no longer match this collection or are drafts.
			vi.mocked(db.query.posts.findMany).mockResolvedValue([
				{ slug: "moved-chapter" },
				{ slug: "draft-chapter" },
			] as never);
			vi.mocked(db.query.posts.findFirst).mockResolvedValue(
				createPostRow({
					collections: [
						{
							slug: "example-collection",
							branch: BRANCH_MAIN,
							title: "Example Collection",
							posts: [{ slug: "example-post", title: "Example Post" }],
						},
					],
				}) as never,
			);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/example-post",
				query: { locale: "en", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().collection.chapters).toEqual([
				{ slug: "example-post", title: "Example Post" },
			]);
			expect(db.query.posts.findFirst).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					with: expect.objectContaining({
						collections: expect.objectContaining({
							with: {
								posts: expect.objectContaining({
									where: {
										locale: "en",
										OR: [
											{ branch: PR_BRANCH },
											{
												branch: BRANCH_MAIN,
												slug: { notIn: ["moved-chapter", "draft-chapter"] },
											},
										],
										publishedAt: { isNotNull: true },
									},
								}),
							},
						}),
					}),
				}),
			);
		});

		test("prefers the requested branch's row for authors and the collection", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);
			vi.mocked(db.query.posts.findFirst).mockResolvedValue(
				createPostRow({
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
						{
							slug: "fennifith",
							branch: BRANCH_MAIN,
							name: "James Fenn",
							profileImage: null,
						},
					],
					collections: [
						{
							slug: "example-collection",
							branch: BRANCH_MAIN,
							title: "Main Collection",
							posts: [{ slug: "chapter-one", title: "Chapter One" }],
						},
						{
							slug: "example-collection",
							branch: PR_BRANCH,
							title: "PR Collection",
							posts: [{ slug: "chapter-one", title: "Chapter One" }],
						},
					],
				}) as never,
			);

			const response = await app.inject({
				method: "GET",
				url: "/content/post/example-post",
				query: { locale: "en", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.authors).toEqual([
				{ id: "crutchcorn", name: "PR Name" },
				{ id: "fennifith", name: "James Fenn" },
			]);
			expect(body.collection).toEqual({
				slug: "example-collection",
				title: "PR Collection",
				chapters: [{ slug: "chapter-one", title: "Chapter One" }],
			});
		});
	});
});
