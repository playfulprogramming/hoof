import { mockEndpoint } from "../../../../test-utils/server.ts";
import { expect, test } from "vitest";
import { fetchPageHtml } from "./fetchPageHtml.ts";
import { fetchPageIcon } from "./fetchPageIcon.ts";

test("Should fetch basic page icon", async () => {
	const html = `
<!DOCTYPE html>
<head>
	<title>Test</title>
	<link rel="shortcut icon" type="image/png" href="/img.png">
</head>
<body>
	<h1>Test</h1>
</body>
</html>
`.trim();

	const domain = "https://example.com/test";
	mockEndpoint({
		path: domain,
		body: html,
		method: "get",
		bodyType: "text",
	});
	const srcHast = await fetchPageHtml(new URL(domain));
	const iconHref = await fetchPageIcon(new URL(domain), srcHast!);

	expect(iconHref).toEqual(new URL("https://example.com/img.png"));
});

test("Should fetch page icon from manifest as backup", async () => {
	const pageHtml = `
<!DOCTYPE html>
<head>
	<title>Test</title>
	<link rel="manifest" href="/manifest.json">
</head>
<body>
	<h1>Test</h1>
</body>
</html>
`.trim();

	const manifest = {
		icons: [
			{
				src: "/manifest-img.png",
				sizes: "96x96",
				type: "image/png",
			},
		],
	};

	const domain = "https://example.com/";
	mockEndpoint({
		path: domain,
		body: pageHtml,
		method: "get",
		bodyType: "text",
	});
	mockEndpoint({
		path: domain + "manifest.json",
		body: manifest,
		method: "get",
		bodyType: "json",
	});

	const srcHast = await fetchPageHtml(new URL(domain));
	const iconHref = await fetchPageIcon(new URL(domain), srcHast!);

	expect(iconHref).toEqual(new URL("https://example.com/manifest-img.png"));
});
