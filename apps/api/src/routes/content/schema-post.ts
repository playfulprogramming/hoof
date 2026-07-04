import type { FastifyPluginAsync } from "fastify";
import { Type } from "typebox";
import { PostMetaSchema } from "../../../../worker/src/tasks/sync-post/types.ts";

const SchemaPostResponseSchema = Type.Object(
	{},
	{
		additionalProperties: true,
		description: "A JSON Schema document describing valid post frontmatter.",
		examples: [PostMetaSchema],
	},
);

const schemaPostRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get(
		"/content/schema/post",
		{
			schema: {
				description:
					"Fetch the JSON Schema for post frontmatter, as validated by the sync worker.",
				response: {
					200: {
						description: "Successful",
						content: {
							"application/json": {
								schema: SchemaPostResponseSchema,
							},
						},
					},
				},
			},
		},
		async (_request, reply) => {
			reply.code(200);
			reply.send(PostMetaSchema);
		},
	);
};

export default schemaPostRoutes;
