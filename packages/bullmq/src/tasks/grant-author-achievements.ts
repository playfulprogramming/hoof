import type { InstallationData } from "../types/common.ts";

export interface GrantAuthorAchievementsInput {
	authorSlug: string;
	installation: InstallationData;
}

export type GrantAuthorAchievementsOutput = void;
