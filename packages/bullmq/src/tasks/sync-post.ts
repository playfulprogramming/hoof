import type { InstallationData } from "../types/common.ts";

export interface SyncPostInput {
	author: string;
	collection?: string;
	post: string;
	/** Internal branch name (main or pull/{number}) */
	branch: string;
	/** SHA of the commit to sync */
	ref: string;
	installation: InstallationData;
}

export type SyncPostOutput = void;
