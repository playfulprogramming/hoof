import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const EnvSchema = Type.Object({
	PORT: Type.Integer({ default: 3000 }),
	WORKER_PORT: Type.Integer({ default: 3001 }),
	ENVIRONMENT: Type.Union([
		Type.Literal("development"),
		Type.Literal("production"),
	]),

	SITE_URL: Type.String(),

	S3_PUBLIC_URL: Type.String(),
	S3_ENDPOINT: Type.String(),
	S3_KEY_ID: Type.String(),
	S3_KEY_SECRET: Type.String(),
	S3_BUCKET: Type.String(),

	POSTGRES_URL: Type.String({ pattern: "^postgresql://.+$" }),

	REDIS_URL: Type.String({ pattern: "^redis://.+$" }),
	REDIS_PASSWORD: Type.Optional(Type.String()),

	// Rate limiting configuration
	RATE_LIMIT_MAX: Type.Integer({ default: 10_000 }),
	RATE_LIMIT_WINDOW: Type.String({ default: "10 minutes" }),
	RATE_LIMIT_BAN_THRESHOLD: Type.Integer({ default: 10 }),
	HOOF_AUTH_TOKEN: Type.Optional(Type.String()),

	GITHUB_REPO_OWNER: Type.String({ default: "playfulprogramming" }),
	GITHUB_REPO_NAME: Type.String({ default: "playfulprogramming" }),
	GITHUB_TOKEN: Type.Optional(Type.String()),
});

export type EnvType = Static<typeof EnvSchema>;

export const env = Value.Parse(EnvSchema, process.env);
