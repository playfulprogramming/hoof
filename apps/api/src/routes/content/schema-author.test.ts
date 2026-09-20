import fastify, { type FastifyInstance } from "fastify";
import schemaAuthorRoutes from "./schema-author.ts";
import { AuthorMetaSchema } from "@playfulprogramming/common";

describe("Schema Author Routes Tests", () => {
	let app: FastifyInstance;
	beforeAll(async () => {
		app = fastify();
		await app.register(schemaAuthorRoutes);
	});

	afterAll(async () => {
		await app.close();
	});

	describe("/content/schema/author", () => {
		test("returns the author frontmatter JSON Schema", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/content/schema/author",
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual(AuthorMetaSchema);
		});
	});
});
