import fastify, { type FastifyInstance } from "fastify";
import profilesRoutes from "./profiles.ts";
import { db } from "@playfulprogramming/db";

describe("Profiles Routes Tests", () => {
	let app: FastifyInstance;
	beforeAll(async () => {
		app = fastify();
		await app.register(profilesRoutes);
	});

	afterAll(async () => {
		await app.close();
	});

	describe("/content/profiles", () => {
		test("returns all profiles", async () => {
			vi.mocked(db.query.profiles.findMany).mockResolvedValue([
				{
					slug: "crutchcorn",
					name: "Corbin Crutchley",
					description: "Project lead for Playful Programming.",
					profileImage: "content/profile.png",
				},
				{
					slug: "fennifith",
					name: "James Fenn",
					description: "Backend lead for Playful Programming.",
					profileImage: null,
				},
			] as never);

			const response = await app.inject({
				method: "GET",
				url: "/content/profiles",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`
				[
				  {
				    "description": "Project lead for Playful Programming.",
				    "id": "crutchcorn",
				    "name": "Corbin Crutchley",
				    "profileImageUrl": "https://s3_public_url.test/s3_bucket/content/profile.png",
				  },
				  {
				    "description": "Backend lead for Playful Programming.",
				    "id": "fennifith",
				    "name": "James Fenn",
				  },
				]
			`);
		});

		test("returns an empty list when there are no profiles", async () => {
			vi.mocked(db.query.profiles.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/profiles",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`[]`);
		});

		test("paginates using page and limit query params", async () => {
			vi.mocked(db.query.profiles.findMany).mockResolvedValue([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/profiles",
				query: { page: "2", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(db.query.profiles.findMany).toBeCalledWith(
				expect.objectContaining({
					offset: 20,
					limit: 10,
				}),
			);
		});
	});
});
