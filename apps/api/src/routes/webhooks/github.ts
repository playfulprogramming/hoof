import type { FastifyPluginAsync } from "fastify";
import { Type, type Static } from "typebox";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import { webhooks } from "@playfulprogramming/github-api";
import { env } from "@playfulprogramming/common";

const MAIN_BRANCH_REF = "refs/heads/main";

const GithubWebhookHeadersSchema = Type.Object({
	"x-hub-signature-256": Type.String(),
	"x-github-delivery": Type.String(),
	"x-github-event": Type.String(),
});

const GithubWebhookResponseSchema = Type.Object(
	{
		enqueued: Type.Boolean(),
	},
	{
		examples: [{ enqueued: true }],
	},
);

const githubWebhookRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.addContentTypeParser<string>(
		"application/json",
		{ parseAs: "string" },
		(_, body, done) => done(null, body),
	);

	fastify.post<{
		Body: string;
		Headers: Static<typeof GithubWebhookHeadersSchema>;
		Reply: Static<typeof GithubWebhookResponseSchema>;
	}>(
		"/webhooks/github",
		{
			schema: {
				description:
					"Receive a GitHub webhook event (https://docs.github.com/en/webhooks/webhook-events-and-payloads). Verifies the X-Hub-Signature-256 header and enqueues the raw payload - interpreting its contents happens in a separate task.",
				headers: GithubWebhookHeadersSchema,
				body: {
					content: {
						"application/json": {
							schema: Type.Any(),
						},
					},
				},
				response: {
					200: {
						description: "Webhook received",
						content: {
							"application/json": {
								schema: GithubWebhookResponseSchema,
							},
						},
					},
				},
			},
		},
		async (request, reply) => {
			const result = await webhooks.verifyAndReceive({
				xGithubDelivery: request.headers["x-github-delivery"],
				xGithubEvent: request.headers["x-github-event"],
				xHubSignature256: request.headers["x-hub-signature-256"],
				payload: request.body,
			});

			if (result.error) {
				fastify.log.error(`Error processing github webhook: ${result.error}`);
			}

			reply.code(result.status);
			reply.send({ enqueued: result.error === undefined });
		},
	);
};

webhooks.registerWebhookListener(async (event) => {
	console.log("Received GitHub webhook", {
		id: event.id,
		name: event.name,
		payload: event.payload,
	});

	if (event.name === "installation") {
		const organization = event.payload.organization?.login;
		if (organization !== env.GITHUB_REPO_OWNER) {
			console.error(
				`Ignoring installation webhook outside of GITHUB_REPO_OWNER ${env.GITHUB_REPO_OWNER}`,
				{
					organization,
					sender: event.payload.sender?.login,
				},
			);
			throw new Error(
				"Attempted installation on a non-playful repository/owner",
			);
		}

		if (event.payload.action === "created") {
			await createJob(Tasks.WEBHOOK_INSTALLATION, event.id, event.payload);
		} else {
			// We only need to observe the installation created event for now
			console.log(`Ignoring unhandled action ${event.payload.action}`);
		}
	}
	if (event.name === "pull_request") {
		if (
			event.payload.repository.full_name !==
			`${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`
		) {
			throw new Error(
				"Attempted pull_request on a non-playful repository/owner.",
			);
		}
		await createJob(Tasks.WEBHOOK_PULL_REQUEST, event.id, event.payload);
	}
	if (event.name === "push") {
		if (
			event.payload.repository.full_name !==
			`${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`
		) {
			throw new Error(
				"Attempted pull_request on a non-playful repository/owner.",
			);
		}
		if (event.payload.ref !== MAIN_BRANCH_REF) {
			console.log("Ignoring push webhook for a non-main branch", {
				ref: event.payload.ref,
			});
			return;
		}
		await createJob(Tasks.WEBHOOK_PUSH, event.id, event.payload);
	}
});

export default githubWebhookRoutes;
