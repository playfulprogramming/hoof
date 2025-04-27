import type { EnvType } from "src/common/env.ts";

declare global {
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface ProcessEnv extends EnvType {}
	}
}
