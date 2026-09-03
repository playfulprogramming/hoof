import type { FastifyPluginAsync } from "fastify";
import { Type, type Static } from "typebox";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import { env } from "@playfulprogramming/common";
import { registerGithubWebhookVerification } from "./verify-signature.ts";

// Loose on purpose - interpreting the payload is #206's job, not this route's.
const PullRequestWebhookBodySchema = Type.Object(
	{},
	{
		additionalProperties: true,
		examples: [
			{
				action: "opened",
			},
		],
	},
);

const GithubWebhookHeadersSchema = Type.Object({
	"x-hub-signature-256": Type.String(),
	"x-github-delivery": Type.String(),
});

const PullRequestWebhookResponseSchema = Type.Object(
	{
		enqueued: Type.Boolean(),
	},
	{
		examples: [{ enqueued: true }],
	},
);

const pullRequestWebhookRoutes: FastifyPluginAsync = async (fastify) => {
	registerGithubWebhookVerification(fastify, env.GITHUB_WEBHOOK_SECRET);

	fastify.post<{
		Body: Static<typeof PullRequestWebhookBodySchema>;
		Headers: Static<typeof GithubWebhookHeadersSchema>;
		Reply: Static<typeof PullRequestWebhookResponseSchema>;
	}>(
		"/webhooks/github/pull_request",
		{
			schema: {
				description:
					"Receive a GitHub `pull_request` webhook event (https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request). Verifies the X-Hub-Signature-256 header and enqueues the raw payload - interpreting its contents happens in a separate task.",
				headers: GithubWebhookHeadersSchema,
				body: {
					content: {
						"application/json": {
							schema: PullRequestWebhookBodySchema,
						},
					},
				},
				response: {
					200: {
						description: "Webhook received",
						content: {
							"application/json": {
								schema: PullRequestWebhookResponseSchema,
							},
						},
					},
				},
			},
		},
		async (request, reply) => {
			const deliveryId = request.headers["x-github-delivery"];

			await createJob(Tasks.WEBHOOK_PULL_REQUEST, deliveryId, request.body);

			reply.code(200);
			reply.send({ enqueued: true });
		},
	);
};

export default pullRequestWebhookRoutes;
