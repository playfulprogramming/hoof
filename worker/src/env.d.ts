namespace NodeJS {
	interface ProcessEnv {
		NODE_ENV: "production" | string;

		WORKER_EXIT_WHEN_DONE: boolean;

		POSTGRES_USER: string;
		POSTGRES_PASSWORD: string;
		POSTGRES_URL: string;

		S3_ENDPOINT: string;
		S3_KEY_ID: string;
		S3_KEY_SECRET: string;
		S3_BUCKET: string;

		FAKTORY_URL: string;
	}
}
