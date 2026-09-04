import crypto from "crypto";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
	interface FastifyRequest {
		// The raw request body string, captured by registerGithubWebhookVerification's
		// content type parser before JSON.parse. Needed because GitHub signs the exact
		// bytes it sent - a re-serialized version of the parsed body isn't guaranteed
		// to match those bytes.
		rawBody?: string;
	}
}

/**
 * Verifies a GitHub webhook's `X-Hub-Signature-256` header against the raw request
 * body, per https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries.
 * Uses the same constant-time comparison pattern as shouldBypassRateLimit, to avoid
 * leaking timing information about how much of the signature matched.
 */
export function verifyGithubSignature(
	rawBody: string,
	signatureHeader: string | string[] | undefined,
	secret: string,
): boolean {
	const signature = Array.isArray(signatureHeader)
		? signatureHeader[0]
		: signatureHeader;

	if (!signature) {
		return false;
	}

	const expectedSignature =
		"sha256=" +
		crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

	const signatureBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expectedSignature);

	if (signatureBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

/**
 * Registers a JSON content type parser that captures the raw request body (so its
 * exact bytes are available for signature verification) and a preValidation hook
 * that rejects the request with a 401 if the X-Hub-Signature-256 header is missing
 * or doesn't match. Both are scoped to the Fastify plugin instance passed in, so
 * they don't affect JSON parsing or validation for any other route in the app.
 */
export function registerGithubWebhookVerification(
	fastify: FastifyInstance,
	secret: string,
): void {
	fastify.addContentTypeParser<string>(
		"application/json",
		{ parseAs: "string" },
		(request, body, done) => {
			request.rawBody = body;
			try {
				done(null, body.length ? JSON.parse(body) : {});
			} catch (err) {
				done(err as Error, undefined);
			}
		},
	);

	fastify.addHook("preValidation", async (request, reply) => {
		const isValid = verifyGithubSignature(
			request.rawBody ?? "",
			request.headers["x-hub-signature-256"],
			secret,
		);

		if (!isValid) {
			reply.code(401).send({ error: "Invalid signature" });
		}
	});
}
