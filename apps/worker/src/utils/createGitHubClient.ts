import { db } from "@playfulprogramming/db";
import {
	createInstallationClient,
	localClient,
} from "@playfulprogramming/github-api";

export async function createGitHubClient(installationId?: number) {
	if (localClient) return localClient;

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
