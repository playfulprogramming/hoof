import type { InstallationData } from "../types/common.ts";

export interface SyncAuthorInput {
	author: string;
	ref: string;
	installation: InstallationData;
}

export type SyncAuthorOutput = void;
