import MockHttp from "@jaredwray/mockhttp";
import path from "path";
import http from "http";
import net from "net";
import { env } from "./env.ts";
import createClient from "openapi-fetch";
import type { paths } from "../src/generated/api-schema.js";
import { afterAll, beforeAll } from "vitest";

const apiClient = createClient<paths>({
	baseUrl: env.API_URL,
});

declare global {
	var client: typeof apiClient;
	var mock: MockHttp;
}

globalThis.client = apiClient;

const MOCK_HTTP_PORT = 4000;

globalThis.mock = new MockHttp({
	port: MOCK_HTTP_PORT,
	autoDetectPort: false,
	apiDocs: false,
	https: {
		cert: path.join(import.meta.dirname, "../src/generated/cert.pem"),
		key: path.join(import.meta.dirname, "../src/generated/key.pem"),
	},
});

const server = http.createServer((req, res) => {
	mock.server.server.emit("request", req, res);
});

server.on("connect", (_req, clientSocket, head) => {
	const serverSocket = net.connect(MOCK_HTTP_PORT, "localhost", () => {
		clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
		serverSocket.write(head);
		serverSocket.pipe(clientSocket);
		clientSocket.pipe(serverSocket);
	});

	serverSocket.on("error", () => clientSocket.end());
	clientSocket.on("error", () => serverSocket.end());
});

beforeAll(async () => {
	await mock.start();
	await new Promise((res) =>
		server.listen(env.MOCK_PROXY_PORT, "0.0.0.0", undefined, () =>
			res(undefined),
		),
	);
});

afterAll(async () => {
	server.close();
	await mock.close();
});
