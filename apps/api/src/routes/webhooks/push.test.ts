import crypto from "crypto";
import fastify from "fastify";
import pushWebhookRoutes from "./push.ts";
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

test("push webhook enqueues a job for a push to main", async () => {
	const app = fastify();
	app.register(pushWebhookRoutes);

	const payload = JSON.stringify({ ref: "refs/heads/main" });

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github/push",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": sign(payload),
			"x-github-delivery": "test-delivery-id",
		},
		payload,
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).to.deep.equal({ enqueued: true });
	expect(createJob).toBeCalledWith("webhook-push", "test-delivery-id", {
		ref: "refs/heads/main",
	});
});

test("push webhook skips a push to a non-main branch without enqueuing", async () => {
	const app = fastify();
	app.register(pushWebhookRoutes);

	const payload = JSON.stringify({ ref: "refs/heads/feature-branch" });

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github/push",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": sign(payload),
			"x-github-delivery": "test-delivery-id",
		},
		payload,
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).to.deep.equal({ enqueued: false });
	expect(createJob).not.toBeCalled();
});

test("push webhook returns 401 for an invalid signature", async () => {
	const app = fastify();
	app.register(pushWebhookRoutes);

	const payload = JSON.stringify({ ref: "refs/heads/main" });

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github/push",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": "sha256=deadbeef",
		},
		payload,
	});

	expect(response.statusCode).to.equal(401);
	expect(createJob).not.toBeCalled();
});

test("push webhook returns 401 when the signature header is missing", async () => {
	const app = fastify();
	app.register(pushWebhookRoutes);

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github/push",
		headers: {
			"content-type": "application/json",
		},
		payload: JSON.stringify({ ref: "refs/heads/main" }),
	});

	expect(response.statusCode).to.equal(401);
	expect(createJob).not.toBeCalled();
});
