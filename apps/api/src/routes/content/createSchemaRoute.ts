import type { FastifyPluginAsync } from "fastify";
import { Type, type TSchema } from "typebox";

export const createSchemaRoute = (
	path: string,
	description: string,
	schema: TSchema,
): FastifyPluginAsync => {
	const responseSchema = Type.Object(
		{},
		{
			additionalProperties: true,
			description,
			examples: [schema],
		},
	);

	return async (fastify) => {
		fastify.get(
			path,
			{
				schema: {
					description,
					response: {
						200: {
							description: "Successful",
							content: {
								"application/json": {
									schema: responseSchema,
								},
							},
						},
					},
				},
			},
			async (_request, reply) => {
				reply.code(200);
				reply.send(schema);
			},
		);
	};
};
