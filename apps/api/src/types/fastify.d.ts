import type { EnvType } from "@playfulprogramming/common";

declare module "fastify" {
	interface FastifyInstance {
		config: EnvType;
	}
}
