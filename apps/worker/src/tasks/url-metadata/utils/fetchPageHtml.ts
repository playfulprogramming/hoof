import type { Element, Root, Node } from "hast";
import { fromHtml } from "hast-util-from-html";
import { find } from "unist-util-find";
import { fetchAsBot } from "../../../utils/fetchAsBot.ts";

export const isElement = (e: Root | Element | Node | undefined): e is Element =>
	e?.type == "element";

export async function fetchPageHtml(src: URL): Promise<Root> {
	const html = await fetchAsBot(src).then((r) => r.text());
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
