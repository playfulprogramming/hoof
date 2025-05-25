import type { Element, Root, Node } from "hast";
import { fromHtml } from "hast-util-from-html";
import { find } from "unist-util-find";
import { visit } from "unist-util-visit";
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

export async function getOpenGraphImages(
	root: Root,
	baseUrl: URL,
): Promise<URL[]> {
	const results: URL[] = [];
	const headNode = find(root, (e) => isElement(e) && e.tagName == "head");
	if (!headNode) return results;

	visit(headNode, { type: "element", tagName: "meta" }, (e: Element) => {
		if (["twitter:image", "og:image"].includes(String(e.properties.property))) {
			try {
				const url = new URL(String(e.properties.content), baseUrl);
				results.push(url);
			} catch (_e) {
				// ignore
			}
		}
	});

	return results;
}
