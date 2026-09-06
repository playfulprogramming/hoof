import type { InstallationData } from "../types/common.ts";

export interface SyncCollectionInput {
	author: string;
	collection: string;
	ref: string;
	installation: InstallationData;
}

export type SyncCollectionOutput = void;
