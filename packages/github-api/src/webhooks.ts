import { app } from "./client.ts";
import type { WebhookError } from "@octokit/webhooks";

type WebhookResult = { status: number; error?: Error };

function isWebhookError(
	e: unknown,
): e is Error & { message: string; event: WebhookError } {
	return (
		e instanceof AggregateError &&
		"event" in e &&
		e.event !== null &&
		typeof e.event === "object" &&
		"status" in e.event &&
		typeof e.event.status === "number"
	);
}

export async function verifyAndReceive(opts: {
	xGithubDelivery: string;
	xGithubEvent: string;
	xHubSignature256: string;
	payload: string;
}): Promise<WebhookResult> {
	try {
		await app.webhooks.verifyAndReceive({
			id: opts.xGithubDelivery,
			name: opts.xGithubEvent,
			signature: opts.xHubSignature256,
			payload: opts.payload,
		});
		return { status: 200 };
	} catch (e) {
		if (isWebhookError(e)) {
			if (
				e.message.includes("signature does not match event payload and secret")
			) {
				return { status: 401, error: e };
			} else {
				return { status: e.event.status ?? 500, error: e };
			}
		} else {
			throw e;
		}
	}
}

export function registerWebhookListener(
	callback: Parameters<typeof app.webhooks.onAny>[0],
) {
	app.webhooks.onAny(callback);
}
