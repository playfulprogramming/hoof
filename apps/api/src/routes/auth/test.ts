import { env } from "@playfulprogramming/common";
import type { FastifyPluginAsync } from "fastify";

export const testAuthRoute: FastifyPluginAsync = async (fastify) => {
	fastify.get("/api/auth/test", async (request, _reply) => {
		const authToken = request.headers["x-hoof-auth-token"];
		const isValidToken = authToken === env.HOOF_AUTH_TOKEN;
		const hasToken = !!authToken;

		return {
			message: "Auth test successful",
			timestamp: new Date().toISOString(),
			rateLimitingBypassed: isValidToken,
			hasToken,
			tokenValid: isValidToken,
		};
	});
};
