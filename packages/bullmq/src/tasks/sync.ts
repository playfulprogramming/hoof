import type { InstallationData } from "../types/common.ts";

interface SyncBaseInput {
	/** Internal branch name (main or pull/{number}) */
	branch: string;
	/** SHA of the commit to sync */
	ref: string;
	installation: InstallationData;
}

export interface SyncAuthorInput extends SyncBaseInput {
	author: string;
}

export interface SyncCollectionInput extends SyncBaseInput {
	author: string;
	collection: string;
}

export interface SyncPostInput extends SyncBaseInput {
	author: string;
	collection?: string;
	post: string;
}
