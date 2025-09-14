import { MockAgent, setGlobalDispatcher } from "undici";

const mockAgent = new MockAgent({
	connections: 1,
	bodyTimeout: 10,
	connectTimeout: 10,
	headersTimeout: 10,
});
setGlobalDispatcher(mockAgent);

interface MockEndpointProps {
	path: string | URL;
	body: string | ArrayBuffer;
	headers?: Record<string, string>;
	method?: "get" | "post" | "put" | "delete";
	status?: number;
}

export function mockEndpoint({
	path,
	body,
	headers,
	method = "get",
	status = 200,
}: MockEndpointProps) {
	const url = path instanceof URL ? path : new URL(path);
	mockAgent
		.get(`${url.protocol}//${url.hostname}`)
		.intercept({
			path: url.pathname,
			method: method,
		})
		.reply(status, body, {
			headers,
		});
}
