import fp from "fastify-plugin";
import fastifyEnv from "@fastify/env";
import { EnvSchema, EnvType } from "../types/env.ts";

declare module "fastify" {
	interface FastifyInstance {
		env: EnvType;
	}
}

export default fp(
	async (fastify) => {
		const opts = {
			schema: EnvSchema,
			dotenv:
				process.env.NODE_ENV === "development"
					? {
							path: "../../.env",
						}
					: false,
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
