import type { InstallationData as OptionalInstallationData } from "../types/common.ts";

type InstallationData = Required<OptionalInstallationData>;

export type WebhookInstallationInput = {
	action: "created";
	installation: InstallationData;
};

export type WebhookPushInput = {
	/** SHA of the previous commit */
	commitBefore: string;
	/** SHA of the new pushed commit */
	commitAfter: string;
	installation: InstallationData;
};

export type WebhookPullRequestInput = {
	/** SHA of the base commit of the PR */
	commitBase: string;
	/** SHA of the latest pushed commit */
	commitHead: string;
	branch: string;
	installation: InstallationData;
};
