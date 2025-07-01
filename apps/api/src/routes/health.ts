import { healthcheckPostgres } from "@playfulprogramming/db";
import { healthcheckRedis } from "@playfulprogramming/redis";
import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (
	fastify,
	_opts,
): Promise<void> => {
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

	fastify.get(
		"/health/postgres",
		{
			schema: {
				summary: "Healthcheck - Postgres",
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
			// check redis connection
			await healthcheckPostgres();

			reply.status(200);
			reply.send("OK");
		},
	);

	fastify.get(
		"/health/redis",
		{
			schema: {
				summary: "Healthcheck - Redis",
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
			// check redis connection
			await healthcheckRedis();

			reply.status(200);
			reply.send("OK");
		},
	);
};
