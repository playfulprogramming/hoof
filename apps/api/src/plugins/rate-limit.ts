import rateLimit from "@fastify/rate-limit";
import { env } from "@playfulprogramming/common";
import fp from "fastify-plugin";

export default fp(
	(fastify) => {
		fastify.register(rateLimit, {
			max: Number(env.RATE_LIMIT_MAX) || 100,
			timeWindow: env.RATE_LIMIT_WINDOW || "1 minute",
			ban: Number(env.RATE_LIMIT_BAN_THRESHOLD) || 10,
			allowList: (request, _key) => {
				const authToken = request.headers["x-hoof-auth-token"];
				return authToken === env.HOOF_AUTH_TOKEN && !!env.HOOF_AUTH_TOKEN;
			},
		});
	},
	{ name: "rate-limit", dependencies: [] },
);
