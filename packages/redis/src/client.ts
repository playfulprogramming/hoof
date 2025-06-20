import { Redis } from "ioredis";
import { env } from "@playfulprogramming/common";

export const redis = new Redis(env.REDIS_URL, {
	family: 6, // Needs to use ipv6 to connect via .internal hostname on fly.io
	password: env.REDIS_PASSWORD,
	maxRetriesPerRequest: null,
});
