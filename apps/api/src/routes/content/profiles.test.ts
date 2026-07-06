import fastify, { type FastifyInstance } from "fastify";
import profilesRoutes from "./profiles.ts";
import { db, profiles, postAuthors, postData } from "@playfulprogramming/db";
import { and, asc, countDistinct, desc, eq, isNotNull } from "drizzle-orm";

function mockSelectChain(rows: unknown[]) {
	const offset = vi.fn().mockResolvedValue(rows);
	const limit = vi.fn().mockReturnValue({ offset });
	const orderBy = vi.fn().mockReturnValue({ limit });
	const groupBy = vi.fn().mockReturnValue({ orderBy });
	const leftJoinPostData = vi.fn().mockReturnValue({ groupBy });
	const leftJoinPostAuthors = vi
		.fn()
		.mockReturnValue({ leftJoin: leftJoinPostData });
	const from = vi.fn().mockReturnValue({ leftJoin: leftJoinPostAuthors });

	vi.mocked(db.select).mockReturnValue({ from } as never);

	return {
		from,
		leftJoinPostAuthors,
		leftJoinPostData,
		groupBy,
		orderBy,
		limit,
		offset,
	};
}

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

		test("returns an empty list when there are no profiles", async () => {
			mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/profiles",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchInlineSnapshot(`[]`);
		});

		test("paginates using page and limit query params", async () => {
			const chain = mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/profiles",
				query: { page: "2", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.limit).toBeCalledWith(10);
			expect(chain.offset).toBeCalledWith(20);
		});

		test("defaults to sortBy=id, ordering by profile slug ascending", async () => {
			const chain = mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/profiles",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.orderBy).toBeCalledWith(asc(profiles.slug));
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
				url: "/content/profiles",
				query: { page: "0", limit: "10", sortBy: "posts" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.orderBy).toBeCalledWith(desc(countDistinct(postData.slug)));
			expect(
				response.json().map((profile: { id: string }) => profile.id),
			).toEqual(["crutchcorn", "fennifith"]);
		});

		test("only counts posts with a publishedAt date and noindex false", async () => {
			const chain = mockSelectChain([]);

			const response = await app.inject({
				method: "GET",
				url: "/content/profiles",
				query: { page: "0", limit: "10" },
			});

			expect(response.statusCode).toBe(200);
			expect(chain.leftJoinPostData).toBeCalledWith(
				postData,
				and(
					eq(postData.slug, postAuthors.postSlug),
					isNotNull(postData.publishedAt),
					eq(postData.noindex, false),
				),
			);
		});
	});
});
