import type { Element, Root, Node } from "hast";
import { fromHtml } from "hast-util-from-html";
import { find } from "unist-util-find";

export const isElement = (e: Root | Element | Node | undefined): e is Element =>
	e?.type == "element";

export async function fetchAsBrowser(input: URL, init?: RequestInit) {
	console.log(`Fetching URL: ${input}`);
	const response = await fetch(input, {
		...init,
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
			"Accept-Language": "en",
			...init?.headers,
		},
		signal: AbortSignal.timeout(10 * 1000),
	});
	if (!response.ok)
		throw new Error(`Request ${input} returned ${response.status}`);
	return response;
}

export async function fetchPageHtml(src: URL): Promise<Root> {
	const html = await fetchAsBrowser(src).then((r) => r.text());
	return fromHtml(html);
}

export function getPageTitle(root: Root): string | undefined {
	const titleEl = find<Element>(root, { tagName: "title" });
	const titleText = titleEl?.children[0];
	return titleText?.type === "text" ? titleText.value.trim() : undefined;
}

export async function getOpenGraphImage(
	root: Root,
	baseUrl: URL,
): Promise<URL | undefined> {
	const metaNode = find<Element>(
		root,
		(e) =>
			isElement(e) &&
			e.tagName === "meta" &&
			["twitter:image", "og:image"].includes(String(e.properties.property)),
	);
	if (!metaNode?.properties.content) return undefined;
	return new URL(String(metaNode.properties.content), baseUrl);
}
