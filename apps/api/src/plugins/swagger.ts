import { env } from "@playfulprogramming/common";
import fp from "fastify-plugin";
import fastifySwagger from "@fastify/swagger";
import fastifyApiReference from "@scalar/fastify-api-reference";

export default fp(
	(fastify) => {
		fastify.register(fastifySwagger, {
			openapi: {
				openapi: "3.0.0",
				info: {
					title: "Hoof",
					description:
						"Backend services for Playful Programming's content management system.",
					version: "0.0.1",
				},
				servers: [
					{
						url: `http://localhost:${env.PORT}`,
						description: "localhost",
					},
					{
						url: "https://hoof.playfulprogramming.com",
						description: "prod",
					},
				],
				externalDocs: {
					url: "https://github.com/playfulprogramming/hoof",
					description: "GitHub",
				},
			},
		});

		fastify.register(fastifyApiReference, {
			routePrefix: "/docs",
		});

		fastify.get("/openapi.json", async (_request, _reply) => {
			return fastify.swagger();
		});
	},
	{ name: "swagger", dependencies: [] },
);
