import type { EnvType } from "src/common/env.ts";

declare global {
	namespace NodeJS {
		interface ProcessEnv extends EnvType {}
	}
}
