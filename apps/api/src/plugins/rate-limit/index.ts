import rateLimit from "@fastify/rate-limit";
import { env } from "@playfulprogramming/common";
import fp from "fastify-plugin";
import crypto from "crypto";

export const shouldBypassRateLimit = (
	request: { headers: { [key: string]: unknown } },
	envToken: string | undefined,
): boolean => {
	const authTokenHeader = request.headers["x-hoof-auth-token"];
	const authToken = Array.isArray(authTokenHeader)
		? authTokenHeader[0]
		: authTokenHeader;

	if (!envToken || !authToken) {
		return false;
	}

	if (authToken.length !== envToken.length) {
		return false;
	}

	return crypto.timingSafeEqual(Buffer.from(authToken), Buffer.from(envToken));
};

export default fp(
	(fastify) => {
		fastify.register(rateLimit, {
			max: env.RATE_LIMIT_MAX,
			timeWindow: env.RATE_LIMIT_WINDOW,
			ban: env.RATE_LIMIT_BAN_THRESHOLD,
			allowList: (request, _key) =>
				shouldBypassRateLimit(request, env.HOOF_AUTH_TOKEN),
		});
	},
	{ name: "rate-limit", dependencies: [] },
);
