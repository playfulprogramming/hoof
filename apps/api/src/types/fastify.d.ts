import type { EnvType } from "@playfulprogramming/types";

declare module "fastify" {
	interface FastifyInstance {
		config: EnvType;
	}
}
