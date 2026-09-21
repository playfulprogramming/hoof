import { env } from "@playfulprogramming/common";
import crypto from "crypto";
import { registerWebhookListener, verifyAndReceive } from "./webhooks.ts";

const webhookCallback = vi.fn(() => undefined);
registerWebhookListener(webhookCallback);

function sign(payload: string): string {
	return (
		"sha256=" +
		crypto
			.createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
			.update(payload)
			.digest("hex")
	);
}

const fakePullRequestPayload = {
	action: "opened",
	repository: {
		full_name: `${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`,
	},
	pull_request: {
		number: 1234,
		base: { sha: "base-sha" },
		head: { sha: "head-sha" },
	},
};

test("given a valid signature, verifyAndReceive returns success", async () => {
	const payload = JSON.stringify(fakePullRequestPayload);

	const result = await verifyAndReceive({
		xGithubDelivery: "fake-id",
		xGithubEvent: "pull_request",
		xHubSignature256: sign(payload),
		payload,
	});

	expect(result).toEqual({ status: 200 });
});

test("given an invalid signature, verifyAndReceive returns a 401 error", async () => {
	const payload = JSON.stringify(fakePullRequestPayload);

	const result = await verifyAndReceive({
		xGithubDelivery: "fake-id",
		xGithubEvent: "pull_request",
		xHubSignature256: sign("wrong-payload"),
		payload,
	});

	expect(result).toEqual({
		status: 401,
		error: expect.toSatisfy((e) =>
			e.message.includes("signature does not match event payload and secret"),
		),
	});
});

test("given a callback error, verifyAndReceive throws the error", async () => {
	const error = new Error("something went wrong");
	webhookCallback.mockImplementation(() => {
		throw error;
	});

	const payload = JSON.stringify(fakePullRequestPayload);

	const result = verifyAndReceive({
		xGithubDelivery: "fake-id",
		xGithubEvent: "pull_request",
		xHubSignature256: sign(payload),
		payload,
	});

	await expect(result).rejects.toMatchObject({
		message: error.message,
		errors: [error],
	});
});
