import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const EnvSchema = Type.Object({
	PORT: Type.Integer({ default: 3000 }),
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
	RATE_LIMIT_MAX: Type.Optional(Type.Integer({ default: 100 })),
	RATE_LIMIT_WINDOW: Type.Optional(Type.String({ default: "1 minute" })),
	RATE_LIMIT_BAN_THRESHOLD: Type.Optional(Type.Integer({ default: 10 })),
	HOOF_AUTH_TOKEN: Type.Optional(Type.String()),
});

export type EnvType = Static<typeof EnvSchema>;

export const env = Value.Parse(EnvSchema, process.env);
