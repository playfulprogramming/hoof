import type { EnvType } from "src/common/env.ts";

declare module "fastify" {
	interface FastifyInstance {
		config: EnvType;
	}
}
