import crypto from "crypto";
import fastify from "fastify";
import pullRequestWebhookRoutes from "./pull-request.ts";
import { createJob } from "@playfulprogramming/bullmq";
import { env } from "@playfulprogramming/common";

function sign(payload: string): string {
	return (
		"sha256=" +
		crypto
			.createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
			.update(payload)
			.digest("hex")
	);
}

test("pull_request webhook enqueues a job", async () => {
	const app = fastify();
	app.register(pullRequestWebhookRoutes);

	const payload = JSON.stringify({ action: "opened" });

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github/pull_request",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": sign(payload),
			"x-github-delivery": "test-delivery-id",
		},
		payload,
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).to.deep.equal({ enqueued: true });
	expect(createJob).toBeCalledWith("webhook-pull-request", "test-delivery-id", {
		action: "opened",
	});
});

test("pull_request webhook returns 401 for an invalid signature", async () => {
	const app = fastify();
	app.register(pullRequestWebhookRoutes);

	const payload = JSON.stringify({ action: "opened" });

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github/pull_request",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": "sha256=deadbeef",
		},
		payload,
	});

	expect(response.statusCode).to.equal(401);
	expect(createJob).not.toBeCalled();
});

test("pull_request webhook returns 401 when the signature header is missing", async () => {
	const app = fastify();
	app.register(pullRequestWebhookRoutes);

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github/pull_request",
		headers: {
			"content-type": "application/json",
		},
		payload: JSON.stringify({ action: "opened" }),
	});

	expect(response.statusCode).to.equal(401);
	expect(createJob).not.toBeCalled();
});
