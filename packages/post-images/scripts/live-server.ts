import http from "http";
import { createPostImage, banner, linkPreview } from "../src/index.ts";
import { fetchPostData } from "../src/fetch-post-data.ts";
import type { LayoutFunction } from "../src/types.ts";

const layouts: Record<string, LayoutFunction> = {
	"/banner": banner,
	"/link-preview": linkPreview,
};

const server = http.createServer(async (req, res) => {
	const url = new URL(String(req.url), "http://localhost");
	const data = await fetchPostData({
		slug: "layered-react-structure",
		author: "crutchcorn",
		path: "content/crutchcorn/posts/layered-react-structure/index.md",
	});
	const image = await createPostImage(
		layouts[url.pathname] ?? linkPreview,
		data,
	);

	res.writeHead(200, { "Content-Type": "image/png" });
	res.write(image);
	res.end();
});

const port = 3000;
server.listen(port, () => {
	console.log(`Server running at http://localhost:${port}/`);
});
