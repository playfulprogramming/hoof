import type { FastifyPluginAsync } from "fastify";

const rootRoute: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
	fastify.get(
		"/",
		{
			schema: {
				summary: "Healthcheck",
				response: {
					200: {
						description: "Successful response",
						content: {
							"text/plain": {
								schema: {
									type: "string",
									example: "OK",
								},
							},
						},
					},
				},
			},
		},
		async function (_request, reply) {
			reply.status(200);
			reply.send("OK");
		},
	);
};

export default rootRoute;
