import path from "path";
import MockHttp from "@jaredwray/mockhttp";

export const MOCK_HTTP_PORT = 4000;

export const mock = new MockHttp({
	port: MOCK_HTTP_PORT,
	autoDetectPort: false,
	apiDocs: false,
	https: {
		cert: path.join(import.meta.dirname, "../src/generated/cert.pem"),
		key: path.join(import.meta.dirname, "../src/generated/key.pem"),
	},
});
