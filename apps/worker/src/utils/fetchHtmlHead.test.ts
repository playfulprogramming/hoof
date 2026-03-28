import { mockEndpoint } from "../../test-utils/server.ts";
import { fetchHtmlHead } from "./fetchHtmlHead.ts";

test("Should return the HTML head when it exists", async () => {
	const robotsUrl = new URL("https://example.com/robots.txt");
	const url = new URL("https://example.com/test");

	mockEndpoint({
		path: robotsUrl,
		body: "User-agent: *\nDisallow:\n",
		headers: {
			"content-type": "text/plain",
		},
	});
	mockEndpoint({
		path: url,
		body: `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<title>Hello world!</title>
				</head>
				<body></body>
			</html>
		`.trim(),
	});

	const response = await fetchHtmlHead(new URL(url));
	expect(response).to.equal(
		`
				<head>
					<title>Hello world!</title>
				</head>
		`.trim(),
	);
});
