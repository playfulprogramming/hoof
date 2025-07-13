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
});

export type EnvType = Static<typeof EnvSchema>;

export const env = Value.Parse(EnvSchema, process.env);
