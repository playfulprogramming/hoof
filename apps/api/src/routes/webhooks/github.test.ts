import crypto from "crypto";
import fastify from "fastify";
import githubWebhookRoutes from "./github.ts";
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

test("installation webhook enqueues a job", async () => {
	const app = fastify();
	app.register(githubWebhookRoutes);

	const payloadObj = {
		action: "created",
		installation: {
			id: 1234,
		},
		organization: {
			login: env.GITHUB_REPO_OWNER,
		},
	};

	const payload = JSON.stringify(payloadObj);

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": sign(payload),
			"x-github-delivery": "test-delivery-id",
			"x-github-event": "installation",
		},
		payload,
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).to.deep.equal({ enqueued: true });
	expect(createJob).toHaveBeenCalledWith(
		"webhook-installation",
		"test-delivery-id",
		payloadObj,
	);
});

test("installation webhook fails if called with a non-pfp org", async () => {
	const app = fastify();
	app.register(githubWebhookRoutes);

	const payloadObj = {
		action: "created",
		installation: {
			id: 1234,
		},
		organization: {
			login: "test",
		},
	};

	const payload = JSON.stringify(payloadObj);

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": sign(payload),
			"x-github-delivery": "test-delivery-id",
			"x-github-event": "installation",
		},
		payload,
	});

	expect(response.statusCode).to.equal(500);
	expect(response.json()).to.deep.equal({
		error: "Internal Server Error",
		message: "Attempted installation on a non-playful repository/owner",
		statusCode: 500,
	});
	expect(createJob).not.toHaveBeenCalled();
});

test("pull_request webhook enqueues a job", async () => {
	const app = fastify();
	app.register(githubWebhookRoutes);

	const payload = JSON.stringify({ action: "opened" });

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": sign(payload),
			"x-github-delivery": "test-delivery-id",
			"x-github-event": "pull_request",
		},
		payload,
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).to.deep.equal({ enqueued: true });
	expect(createJob).toHaveBeenCalledWith(
		"webhook-pull-request",
		"test-delivery-id",
		{
			action: "opened",
		},
	);
});

test("push webhook enqueues a job", async () => {
	const app = fastify();
	app.register(githubWebhookRoutes);

	const payload = JSON.stringify({ ref: "refs/heads/main" });

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": sign(payload),
			"x-github-delivery": "test-delivery-id",
			"x-github-event": "push",
		},
		payload,
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).to.deep.equal({ enqueued: true });
	expect(createJob).toHaveBeenCalledWith("webhook-push", "test-delivery-id", {
		ref: "refs/heads/main",
	});
});

test("webhook handler returns 401 for an invalid signature", async () => {
	const app = fastify();
	app.register(githubWebhookRoutes);

	const payload = JSON.stringify({ action: "opened" });

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": "sha256=deadbeef",
			"x-github-delivery": "test-delivery-id",
			"x-github-event": "pull_request",
		},
		payload,
	});

	expect(response.statusCode).to.equal(401);
	expect(createJob).not.toHaveBeenCalled();
});

test("webhook handler returns 400 when the signature header is missing", async () => {
	const app = fastify();
	app.register(githubWebhookRoutes);

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github",
		headers: {
			"content-type": "application/json",
			"x-github-delivery": "test-delivery-id",
			"x-github-event": "pull_request",
		},
		payload: JSON.stringify({ action: "opened" }),
	});

	expect(response.statusCode).to.equal(400);
	expect(createJob).not.toHaveBeenCalled();
});

test("webhook handler returns 400 when the delivery id header is missing", async () => {
	const app = fastify();
	app.register(githubWebhookRoutes);

	const payload = JSON.stringify({ action: "opened" });

	const response = await app.inject({
		method: "POST",
		url: "/webhooks/github",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": sign(payload),
			"x-github-event": "pull_request",
		},
		payload,
	});

	expect(response.statusCode).to.equal(400);
	expect(createJob).not.toHaveBeenCalled();
});
