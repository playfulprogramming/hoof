import type { InstallationData } from "../types/common.ts";

export interface SyncCollectionInput {
	author: string;
	collection: string;
	/** Internal branch name (main or pull/{number}) */
	branch: string;
	/** SHA of the commit to sync */
	ref: string;
	installation: InstallationData;
}

export type SyncCollectionOutput = void;
