import fastify, { type FastifyInstance } from "fastify";
import collectionsRoutes from "./collections.ts";
import { db } from "@playfulprogramming/db";

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
			vi.mocked(db.query.collections.findMany).mockReturnValue([
				{
					slug: "harsh-leadership-truths",
					data: [
						{
							title: "Harsh Leadership Truths",
							description:
								"Exploring the often overlooked realities of engineering leadership.",
							coverImage: "content/cover.png",
						},
					],
					posts: [{ collectionOrder: 1 }, { collectionOrder: 2 }],
					authors: [
						{
							slug: "crutchcorn",
							name: "Corbin Crutchley",
							profileImage: "content/profile.png",
						},
						{
							slug: "fennifith",
							name: "James Fenn",
							profileImage: "content/profile.png",
						},
					],
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
			vi.mocked(db.query.collections.findMany).mockReturnValue([] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/collections",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`[]`);
		});

		test("collections returns all collections for the given author", async () => {
			vi.mocked(db.query.collections.findMany).mockReturnValue([
				{
					slug: "harsh-leadership-truths",
					data: [
						{
							title: "Harsh Leadership Truths",
							description:
								"Exploring the often overlooked realities of engineering leadership.",
							coverImage: null,
						},
					],
					posts: [{ collectionOrder: 1 }],
					authors: [
						{
							slug: "crutchcorn",
							name: "Corbin Crutchley",
							profileImage: null,
						},
					],
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
			vi.mocked(db.query.collections.findMany).mockReturnValue([] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/collections",
				query: { page: "0", limit: "10", author: "non-existent-author" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`[]`);
		});
	});
});
