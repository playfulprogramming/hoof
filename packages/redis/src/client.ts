import { Redis } from "ioredis";
import { env } from "@playfulprogramming/common";

export const redis = new Redis(env.REDIS_URL, {
	maxRetriesPerRequest: null,
});
