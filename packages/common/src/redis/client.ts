import { Redis } from "ioredis";
import { env } from "../env.ts";

export const redis = new Redis(env.REDIS_URL, {
	maxRetriesPerRequest: null,
});
