import type { FastifyPluginAsync } from "fastify";
import { Type, type Static } from "typebox";
import { Tasks, createJob } from "@playfulprogramming/bullmq";
import { env } from "@playfulprogramming/common";
import { registerGithubWebhookVerification } from "./verify-signature.ts";

const MAIN_BRANCH_REF = "refs/heads/main";

// Loose on purpose - interpreting the rest of the payload is #206's job, not this
// route's. `ref` is the one field this route itself needs, to filter to main.
const PushWebhookBodySchema = Type.Object(
	{
		ref: Type.Optional(Type.String()),
	},
	{
		additionalProperties: true,
		examples: [
			{
				ref: "refs/heads/main",
			},
		],
	},
);

const GithubWebhookHeadersSchema = Type.Object({
	"x-hub-signature-256": Type.String(),
	"x-github-delivery": Type.String(),
});

const PushWebhookResponseSchema = Type.Object(
	{
		enqueued: Type.Boolean(),
	},
	{
		examples: [{ enqueued: true }],
	},
);

const pushWebhookRoutes: FastifyPluginAsync = async (fastify) => {
	registerGithubWebhookVerification(fastify, env.GITHUB_WEBHOOK_SECRET);

	fastify.post<{
		Body: Static<typeof PushWebhookBodySchema>;
		Headers: Static<typeof GithubWebhookHeadersSchema>;
		Reply: Static<typeof PushWebhookResponseSchema>;
	}>(
		"/webhooks/github/push",
		{
			schema: {
				description:
					"Receive a GitHub `push` webhook event (https://docs.github.com/en/webhooks/webhook-events-and-payloads#push). Verifies the X-Hub-Signature-256 header, filters to the main branch, and enqueues the raw payload - interpreting its contents happens in a separate task.",
				headers: GithubWebhookHeadersSchema,
				body: {
					content: {
						"application/json": {
							schema: PushWebhookBodySchema,
						},
					},
				},
				response: {
					200: {
						description: "Webhook received",
						content: {
							"application/json": {
								schema: PushWebhookResponseSchema,
							},
						},
					},
				},
			},
		},
		async (request, reply) => {
			if (request.body.ref !== MAIN_BRANCH_REF) {
				fastify.log.info(
					{ ref: request.body.ref },
					"Ignoring push webhook for a non-main branch",
				);
				reply.code(200);
				reply.send({ enqueued: false });
				return;
			}

			const deliveryId = request.headers["x-github-delivery"];

			await createJob(Tasks.WEBHOOK_PUSH, deliveryId, request.body);

			reply.code(200);
			reply.send({ enqueued: true });
		},
	);
};

export default pushWebhookRoutes;
