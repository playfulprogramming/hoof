import fastify, { type FastifyInstance } from "fastify";
import collectionsRoutes from "./collections.ts";
import { db } from "@playfulprogramming/db";
import { BRANCH_MAIN } from "@playfulprogramming/common";

const PR_BRANCH = "pull/42";

describe("Collections Routes Tests", () => {
	let app: FastifyInstance;
	beforeAll(async () => {
		app = fastify();
		await app.register(collectionsRoutes);
	});

	afterAll(async () => {
		await app.close();
	});

	describe("/content/collections", () => {
		test("collections returns all collections", async () => {
			vi.mocked(db.query.collections.findMany).mockResolvedValue([
				{
					slug: "harsh-leadership-truths",
					title: "Harsh Leadership Truths",
					description:
						"Exploring the often overlooked realities of engineering leadership.",
					coverImage: "content/cover.png",
					authors: [
						{
							slug: "crutchcorn",
							branch: BRANCH_MAIN,
							name: "Corbin Crutchley",
							profileImage: "content/profile.png",
						},
						{
							slug: "fennifith",
							branch: BRANCH_MAIN,
							name: "James Fenn",
							profileImage: "content/profile.png",
						},
					],
					posts: [{ slug: "chapter-one" }, { slug: "chapter-two" }],
				},
			] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/collections",
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
				      {
				        "id": "fennifith",
				        "name": "James Fenn",
				        "profileImageUrl": "https://s3_public_url.test/s3_bucket/content/profile.png",
				      },
				    ],
				    "chapterCount": 2,
				    "coverUrl": "https://s3_public_url.test/s3_bucket/content/cover.png",
				    "description": "Exploring the often overlooked realities of engineering leadership.",
				    "slug": "harsh-leadership-truths",
				    "title": "Harsh Leadership Truths",
				  },
				]
			`);
		});

		test("collections returns an empty list for no collections", async () => {
			vi.mocked(db.query.collections.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/collections",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`[]`);
		});

		test("collections returns all collections for the given author", async () => {
			vi.mocked(db.query.collections.findMany).mockResolvedValue([
				{
					slug: "harsh-leadership-truths",
					title: "Harsh Leadership Truths",
					description:
						"Exploring the often overlooked realities of engineering leadership.",
					coverImage: null,
					authors: [
						{
							slug: "crutchcorn",
							branch: BRANCH_MAIN,
							name: "Corbin Crutchley",
							profileImage: null,
						},
					],
					posts: [{ slug: "chapter-one" }],
				},
			] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/collections",
				query: { page: "0", limit: "10", author: "crutchcorn" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`
				[
				  {
				    "authors": [
				      {
				        "id": "crutchcorn",
				        "name": "Corbin Crutchley",
				      },
				    ],
				    "chapterCount": 1,
				    "description": "Exploring the often overlooked realities of engineering leadership.",
				    "slug": "harsh-leadership-truths",
				    "title": "Harsh Leadership Truths",
				  },
				]
			`);
		});

		test("collections returns an empty list for an author who has no collections", async () => {
			vi.mocked(db.query.collections.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/collections",
				query: { page: "0", limit: "10", author: "non-existent-author" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`[]`);
		});

		test("defaults branch to BRANCH_MAIN and skips the branch slug queries", async () => {
			vi.mocked(db.query.collections.findMany).mockResolvedValue([]);

			await app.inject({
				method: "GET",
				url: "/content/collections",
				query: { page: "0", limit: "10" },
			});

			expect(db.query.posts.findMany).not.toHaveBeenCalled();
			expect(db.query.collections.findMany).toHaveBeenCalledTimes(1);
			expect(db.query.collections.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						locale: "en",
						branch: BRANCH_MAIN,
					}),
					with: {
						authors: expect.objectContaining({
							where: { branch: { in: [BRANCH_MAIN] } },
						}),
						posts: expect.objectContaining({
							where: {
								locale: "en",
								branch: BRANCH_MAIN,
								publishedAt: { isNotNull: true },
							},
						}),
					},
				}),
			);
		});

		test("fetches the requested branch's collection slugs and post slugs for the locale", async () => {
			vi.mocked(db.query.collections.findMany).mockResolvedValue([]);
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

			await app.inject({
				method: "GET",
				url: "/content/collections",
				query: { page: "0", limit: "10", branch: PR_BRANCH, locale: "es" },
			});

			expect(db.query.collections.findMany).toHaveBeenCalledTimes(2);
			expect(db.query.collections.findMany).toHaveBeenNthCalledWith(1, {
				columns: { slug: true },
				where: { locale: "es", branch: PR_BRANCH },
			});
			// No publish or noindex filter: any branch row hides main's copy.
			expect(db.query.posts.findMany).toHaveBeenCalledExactlyOnceWith({
				columns: { slug: true },
				where: { locale: "es", branch: PR_BRANCH },
			});
		});

		test("lists the requested branch's rows, or main's rows for slugs the branch does not have", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);
			vi.mocked(db.query.collections.findMany)
				.mockResolvedValue([])
				.mockResolvedValueOnce([{ slug: "edited-collection" }] as never);

			await app.inject({
				method: "GET",
				url: "/content/collections",
				query: {
					page: "2",
					limit: "10",
					branch: PR_BRANCH,
					author: "crutchcorn",
				},
			});

			expect(db.query.collections.findMany).toHaveBeenNthCalledWith(2, {
				where: {
					locale: "en",
					OR: [
						{ branch: PR_BRANCH },
						{ branch: BRANCH_MAIN, slug: { notIn: ["edited-collection"] } },
					],
					authors: { slug: "crutchcorn" },
				},
				with: {
					authors: expect.objectContaining({
						where: { branch: { in: [PR_BRANCH, BRANCH_MAIN] } },
					}),
					posts: expect.anything(),
				},
				offset: 20,
				limit: 10,
			});
		});

		test("does not send an empty not-in list when the requested branch has no rows", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);
			vi.mocked(db.query.collections.findMany).mockResolvedValue([]);

			await app.inject({
				method: "GET",
				url: "/content/collections",
				query: { page: "0", limit: "10", branch: PR_BRANCH },
			});

			const branchOrMain = [{ branch: PR_BRANCH }, { branch: BRANCH_MAIN }];
			expect(db.query.collections.findMany).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					where: expect.objectContaining({ OR: branchOrMain }),
					with: expect.objectContaining({
						posts: expect.objectContaining({
							where: {
								locale: "en",
								OR: branchOrMain,
								publishedAt: { isNotNull: true },
							},
						}),
					}),
				}),
			);
		});

		test("returns rows from the requested branch and from main, preferring the requested branch's author row", async () => {
			vi.mocked(db.query.posts.findMany).mockResolvedValue([]);
			vi.mocked(db.query.collections.findMany)
				.mockResolvedValue([])
				.mockResolvedValueOnce([{ slug: "edited-collection" }] as never)
				.mockResolvedValueOnce([
					{
						slug: "edited-collection",
						title: "Edited On The PR",
						description: "",
						coverImage: null,
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
						posts: [],
					},
					{
						slug: "main-only-collection",
						title: "Only On Main",
						description: "",
						coverImage: null,
						authors: [
							{
								slug: "fennifith",
								branch: BRANCH_MAIN,
								name: "James Fenn",
								profileImage: null,
							},
						],
						posts: [],
					},
				] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/collections",
				query: { page: "0", limit: "10", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			expect(
				response
					.json()
					.map((collection: { slug: string; authors: unknown[] }) => [
						collection.slug,
						collection.authors,
					]),
			).toEqual([
				["edited-collection", [{ id: "crutchcorn", name: "PR Name" }]],
				["main-only-collection", [{ id: "fennifith", name: "James Fenn" }]],
			]);
		});

		test("chapterCount does not count main's copy of a post the requested branch moved out of the collection or unpublished", async () => {
			// The branch has rows for both slugs, so main's copies are excluded by slug
			// even though the branch's rows no longer match this collection or are drafts.
			vi.mocked(db.query.posts.findMany).mockResolvedValue([
				{ slug: "moved-chapter" },
				{ slug: "draft-chapter" },
			] as never);
			vi.mocked(db.query.collections.findMany)
				.mockResolvedValue([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([
					{
						slug: "example-collection",
						title: "Example Collection",
						description: "",
						coverImage: null,
						authors: [],
						posts: [{ slug: "chapter-one" }, { slug: "chapter-two" }],
					},
				] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/collections",
				query: { page: "0", limit: "10", branch: PR_BRANCH },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()[0].chapterCount).toBe(2);
			expect(db.query.collections.findMany).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					with: expect.objectContaining({
						posts: {
							columns: { slug: true },
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
						},
					}),
				}),
			);
		});
	});
});
