import type { InstallationData } from "../types/common.ts";

export interface SyncPostInput {
	author: string;
	collection?: string;
	post: string;
	ref: string;
	installation: InstallationData;
}

export type SyncPostOutput = void;
