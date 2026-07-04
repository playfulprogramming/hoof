import fastify, { type FastifyInstance } from "fastify";
import schemaPostRoutes from "./schema-post.ts";
import { PostMetaSchema } from "../../../../worker/src/tasks/sync-post/types.ts";

describe("Schema Post Routes Tests", () => {
	let app: FastifyInstance;
	beforeAll(async () => {
		app = fastify();
		await app.register(schemaPostRoutes);
	});

	afterAll(async () => {
		await app.close();
	});

	describe("/content/schema/post", () => {
		test("returns the post frontmatter JSON Schema", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/content/schema/post",
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual(PostMetaSchema);
		});
	});
});
