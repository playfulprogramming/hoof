import type { FastifyPluginAsync } from "fastify";
import { Type } from "typebox";
import { CollectionMetaSchema } from "../../../../worker/src/tasks/sync-collection/types.ts";

const SchemaCollectionResponseSchema = Type.Object(
	{},
	{
		additionalProperties: true,
		description:
			"A JSON Schema document describing valid collection frontmatter.",
		examples: [CollectionMetaSchema],
	},
);

const schemaCollectionRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get(
		"/content/schema/collection",
		{
			schema: {
				description:
					"Fetch the JSON Schema for collection frontmatter, as validated by the sync worker.",
				response: {
					200: {
						description: "Successful",
						content: {
							"application/json": {
								schema: SchemaCollectionResponseSchema,
							},
						},
					},
				},
			},
		},
		async (_request, reply) => {
			reply.code(200);
			reply.send(CollectionMetaSchema);
		},
	);
};

export default schemaCollectionRoutes;
