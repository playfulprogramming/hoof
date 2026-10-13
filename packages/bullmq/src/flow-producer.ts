import { env } from "@playfulprogramming/common";
import { redis } from "@playfulprogramming/redis";
import { FlowProducer } from "bullmq";

export const flowProducer = new FlowProducer({
	connection: redis,
	prefix: env.BULLMQ_PREFIX,
});
