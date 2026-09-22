import http from "http";
import net from "net";
import { mock, MOCK_HTTP_PORT } from "./mock.ts";
import "./url-metadata.ts";
import { env } from "../src/util/env.ts";

await mock.start();

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

server.listen(env.MOCK_PROXY_PORT, "0.0.0.0");
