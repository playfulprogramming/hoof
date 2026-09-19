import crypto from "crypto";
import fastify from "fastify";
import githubWebhookRoutes from "./github.ts";
import { createJob } from "@playfulprogramming/bullmq";
import { env } from "@playfulprogramming/common";

vi.mock("@playfulprogramming/github-api", () => {
	type WebhookListener = (payload: unknown) => Promise<unknown>;
	const listeners: WebhookListener[] = [];

	return {
		webhooks: {
			verifyAndReceive: vi.fn(
				async ({
					xGithubDelivery,
					xGithubEvent,
					xHubSignature256,
					payload,
				}) => {
					if (xHubSignature256 === "invalid-signature") {
						return {
							status: 401,
							error: new Error(
								"signature does not match event payload and secret",
							),
						};
					}

					for (const listener of listeners) {
						await listener({
							id: xGithubDelivery,
							name: xGithubEvent,
							payload: JSON.parse(payload),
						});
					}
					return { status: 200 };
				},
			),
			registerWebhookListener: (listener: WebhookListener) =>
				listeners.push(listener),
		},
	};
});

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

	const payloadObj = {
		action: "opened",
		repository: {
			full_name: `${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`,
		},
		pull_request: {
			number: 1234,
			base: { sha: "base-sha" },
			head: { sha: "head-sha" },
		},
		installation: {
			id: 0,
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
			commitBase: payloadObj.pull_request.base.sha,
			commitHead: payloadObj.pull_request.head.sha,
			branch: `pull/${payloadObj.pull_request.number}`,
			installation: payloadObj.installation,
		},
	);
});

test("push webhook enqueues a job", async () => {
	const app = fastify();
	app.register(githubWebhookRoutes);

	const payloadObj = {
		ref: "refs/heads/main",
		repository: {
			full_name: `${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`,
		},
		before: "before-sha",
		after: "after-sha",
		installation: {
			id: 0,
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
			"x-github-event": "push",
		},
		payload,
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).to.deep.equal({ enqueued: true });
	expect(createJob).toHaveBeenCalledWith("webhook-push", "test-delivery-id", {
		commitBefore: payloadObj.before,
		commitAfter: payloadObj.after,
		installation: payloadObj.installation,
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
			"x-hub-signature-256": "invalid-signature",
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
