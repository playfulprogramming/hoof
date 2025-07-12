import type { Root, Element } from "hast";
import { find } from "unist-util-find";
import { visit } from "unist-util-visit";
import { isElement } from "./fetchPageHtml.ts";
import { getLargestManifestIcon } from "./getLargestManifestIcon.ts";
import { fetchAsBot } from "../../../utils/fetchAsBot.ts";

export async function fetchPageIcons(
	src: URL,
	root: Root,
	signal?: AbortSignal,
): Promise<URL[]> {
	const results: URL[] = [];
	const headNode = find(root, (e) => isElement(e) && e.tagName == "head");
	if (!headNode) return results;

	// Try getting icon from link tags first
	visit(headNode, { type: "element", tagName: "link" }, (node: Element) => {
		const rel = String(node.properties?.rel ?? "");
		const href = String(node.properties?.href ?? "");
		if (!rel.includes("icon")) return;

		try {
			const hrefUrl = new URL(href, src);
			results.push(hrefUrl);
		} catch {
			// ignore
		}
	});

	// Try getting icon from web manifest
	const manifestLink: Element | undefined = find(
		headNode,
		(node) =>
			isElement(node) &&
			node.tagName === "link" &&
			String(node.properties.rel).includes("manifest"),
	);

	if (manifestLink?.properties?.href) {
		const manifestUrl = new URL(String(manifestLink.properties.href), src);
		const manifest = await fetchAsBot({
			url: manifestUrl,
			method: "GET",
			skipRobotsCheck: true,
			signal,
		})
			.then((r) => r.body.json())
			.catch(() => null);

		if (manifest) {
			const icons = getLargestManifestIcon(manifestUrl, manifest).map(
				(icon) => icon.src,
			);
			results.push(...icons);
		}
	}

	return results;
}
