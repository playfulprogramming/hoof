import { Static, Type } from "@sinclair/typebox";

export const EnvSchema = Type.Object({
	ENVIRONMENT: Type.Union([
		Type.Literal("development"),
		Type.Literal("production"),
	]),

	CLIENT_URL: Type.String({ format: "uri" }),

	FLY_API_URL: Type.Optional(Type.String()),
	FLY_API_TOKEN: Type.String(),
	FLY_WORKER_APP_NAME: Type.String(),

	S3_PUBLIC_URL: Type.String({ format: "uri" }),
	S3_ENDPOINT: Type.String({ format: "uri" }),
	S3_KEY_ID: Type.String(),
	S3_KEY_SECRET: Type.String(),
	S3_BUCKET: Type.String(),

	POSTGRES_USER: Type.String(),
	POSTGRES_PASSWORD: Type.String(),
	POSTGRES_URL: Type.String({ pattern: "^postgresql://.+$" }),
});

export type EnvType = Static<typeof EnvSchema>;
