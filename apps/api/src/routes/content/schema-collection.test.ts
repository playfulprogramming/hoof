import fastify, { type FastifyInstance } from "fastify";
import schemaCollectionRoutes from "./schema-collection.ts";
import { CollectionMetaSchema } from "@playfulprogramming/common";

describe("Schema Collection Routes Tests", () => {
	let app: FastifyInstance;
	beforeAll(async () => {
		app = fastify();
		await app.register(schemaCollectionRoutes);
	});

	afterAll(async () => {
		await app.close();
	});

	describe("/content/schema/collection", () => {
		test("returns the collection frontmatter JSON Schema", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/content/schema/collection",
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual(CollectionMetaSchema);
		});
	});
});
