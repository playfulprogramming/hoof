import fp from "fastify-plugin";
import fastifyEnv from "@fastify/env";
import { EnvSchema } from "@playfulprogramming/common";

export default fp(
	(fastify) => {
		const opts = {
			schema: EnvSchema,
		};

		fastify.register(fastifyEnv, opts).ready((err) => {
			if (err) {
				fastify.log.error(err);
				process.exit(1);
			}
		});
	},
	{ name: "env", dependencies: [] },
);
