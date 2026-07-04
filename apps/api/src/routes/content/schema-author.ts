import type { FastifyPluginAsync } from "fastify";
import { Type } from "typebox";
import { AuthorMetaSchema } from "../../../../worker/src/tasks/sync-author/types.ts";

const SchemaAuthorResponseSchema = Type.Object(
	{},
	{
		additionalProperties: true,
		description: "A JSON Schema document describing valid author frontmatter.",
		examples: [AuthorMetaSchema],
	},
);

const schemaAuthorRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get(
		"/content/schema/author",
		{
			schema: {
				description:
					"Fetch the JSON Schema for author frontmatter, as validated by the sync worker.",
				response: {
					200: {
						description: "Successful",
						content: {
							"application/json": {
								schema: SchemaAuthorResponseSchema,
							},
						},
					},
				},
			},
		},
		async (_request, reply) => {
			reply.code(200);
			reply.send(AuthorMetaSchema);
		},
	);
};

export default schemaAuthorRoutes;
