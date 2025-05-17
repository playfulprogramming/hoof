import type { Root, Element } from "hast";
import { find } from "unist-util-find";
import * as path from "path";
import { fetchAsBrowser, isElement } from "./fetchPageHtml.ts";
import { getLargestManifestIcon } from "./getLargestManifestIcon.ts";

export async function fetchPageIcon(
	src: URL,
	root: Root,
): Promise<URL | undefined> {
	const iconExtensions = [".svg", ".png", ".jpg", ".jpeg"];

	// Try getting icon from link tags first
	const favicon: Element | undefined = find(root, (node) => {
		if (!isElement(node) || node.tagName !== "link") return false;
		const rel = String(node.properties?.rel ?? "");
		const href = String(node.properties?.href ?? "");

		try {
			const hrefUrl = new URL(href, src);
			const extname = path.extname(hrefUrl.pathname);
			return rel.includes("icon") && iconExtensions.includes(extname);
		} catch {
			return false;
		}
	});

	if (favicon?.properties?.href) {
		return new URL(String(favicon.properties.href), src);
	}

	// Try getting icon from web manifest
	const manifestLink: Element | undefined = find(
		root,
		(node) =>
			isElement(node) &&
			node.tagName === "link" &&
			String(node.properties.rel).includes("manifest"),
	);

	if (manifestLink?.properties?.href) {
		const manifestUrl = new URL(String(manifestLink.properties.href), src);
		const manifest = await fetchAsBrowser(manifestUrl)
			.then((r) => r.json())
			.catch(() => null);

		if (manifest) {
			const largestIcon = getLargestManifestIcon(manifest);
			if (largestIcon?.icon) {
				return new URL(largestIcon.icon.src, src.origin);
			}
		}
	}

	return undefined;
}
