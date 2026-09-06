import * as undici from "undici";
import { env } from "@playfulprogramming/common";
import { App, Octokit, RequestError } from "octokit";

export const app = new App({
	appId: env.GITHUB_APP_ID,
	privateKey: env.GITHUB_APP_PRIVATE_KEY,
	webhooks: {
		secret: env.GITHUB_WEBHOOK_SECRET,
	},
	Octokit: Octokit.defaults({
		request: {
			fetch: undici.fetch,
		},
	}),
});

export async function createOctokit(installationId: number): Promise<Octokit> {
	return await app.getInstallationOctokit(installationId);
}

export const localClient = env.GITHUB_TOKEN
	? new Octokit({
			userAgent: env.GITHUB_REPO_OWNER,
			auth: env.GITHUB_TOKEN,
			request: {
				fetch: undici.fetch,
			},
		})
	: undefined;

export function handleRequestError(e: unknown) {
	if (e instanceof RequestError && typeof e.response?.status === "number") {
		return { status: e.response.status, data: undefined };
	}
	throw e;
}
