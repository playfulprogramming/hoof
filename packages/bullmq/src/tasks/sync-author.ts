import type { InstallationData } from "../types/common.ts";

export interface SyncAuthorInput {
	author: string;
	/** Internal branch name (main or pull/{number}) */
	branch: string;
	/** SHA of the commit to sync */
	ref: string;
	installation: InstallationData;
}

export type SyncAuthorOutput = void;
