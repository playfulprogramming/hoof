import { redis } from "@playfulprogramming/redis";
import { FlowProducer } from "bullmq";

export const flowProducer = new FlowProducer({ connection: redis });
