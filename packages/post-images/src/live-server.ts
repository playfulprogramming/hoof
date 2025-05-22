import http from "http";
import { createPostImage, linkPreview } from "./index.ts";

const server = http.createServer(async (req, res) => {
	const _url = new URL(String(req.url), "http://localhost");
	const data = await createPostImage(linkPreview, {
		slug: "art-of-a11y-labels",
		title: "The Art of Accessibility: Labels",
		authors: [
			{
				name: "Crutchin Corbley",
				image:
					"https://playfulprogramming.com/content/crutchcorn/crutchcorn.png",
			},
		],
		tags: [],
		publishedMeta: "May 7, 2025",
		wordCount: 2831,
		code: `<!-- ... -->\n\n<li role="tab" id="javascript-tab" aria-selected="true" aria-controls="javascript-panel">\nJavaScript\n</li>\n\n<!-- ... -->\n\n<div role="tabpanel" id="javascript-panel" aria-labelledby="javascript-tab">\n\n<!-- ... -->\n<!-- DO NOT DO THIS, IT IS INACCESSIBLE -->`,
	});

	res.writeHead(200, { "Content-Type": "image/png" });
	res.write(data);
	res.end();
});

const port = 3000;
server.listen(port, () => {
	console.log(`Server running at http://localhost:${port}/`);
});
