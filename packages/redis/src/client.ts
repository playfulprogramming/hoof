import { Redis } from "ioredis";
import { env } from "@playfulprogramming/common";

export const redis = new Redis(env.REDIS_URL, {
	family: env.ENVIRONMENT == "production" ? 6 : undefined, // Needs to use ipv6 to connect via .internal hostname on fly.io
	password: env.REDIS_PASSWORD,
	maxRetriesPerRequest: null,
});
