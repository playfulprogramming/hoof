import { env } from "@playfulprogramming/common";
import { db } from "@playfulprogramming/db";
import {
	createInstallationClient,
	publicClient,
} from "@playfulprogramming/github-api";

export async function createGitHubClient(installationId?: number) {
	if (env.ENVIRONMENT === "development") return publicClient;

	if (typeof installationId === "undefined") {
		const installation = await db.query.githubInstallations.findFirst();
		installationId = installation?.installationId;
	}

	if (typeof installationId !== "undefined") {
		return createInstallationClient(installationId);
	} else {
		throw new Error(`No installation ID exists!`);
	}
}
