import type { EnvType } from "@playfulprogramming/common";

declare global {
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface ProcessEnv extends EnvType {}
	}
}
