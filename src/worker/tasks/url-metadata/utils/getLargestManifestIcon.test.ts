import { expect, test } from "vitest";
import { getLargestManifestIcon } from "./getLargestManifestIcon.ts";

test("Should return null if no manifest icon found", async () => {
	const largestManifestIcon = getLargestManifestIcon({
		name: "Test",
	});

	expect(largestManifestIcon).toBe(null);
});

test("Should return single manifest icon in array", async () => {
	const largestManifestIcon = getLargestManifestIcon({
		icons: [
			{
				src: "icon.png",
				sizes: "48x48",
				type: "image/png",
			},
		],
	});

	expect(largestManifestIcon).toEqual({
		size: 48,
		icon: {
			src: "icon.png",
			sizes: "48x48",
			type: "image/png",
		},
	});
});

test("Should return single manifest icon in record", async () => {
	const largestManifestIcon = getLargestManifestIcon({
		icons: {
			"48x48": "icon.png",
		},
	});

	expect(largestManifestIcon).toEqual({
		size: 48,
		icon: {
			src: "icon.png",
			sizes: "48x48",
		},
	});
});

test("Should return biggest manifest icon in record", async () => {
	const largestManifestIcon = getLargestManifestIcon({
		icons: {
			"48x48": "icon48.png",
			"72x72": "icon72.png",
			"145x145": "icon145.png",
		},
	});

	expect(largestManifestIcon).toEqual({
		size: 145,
		icon: {
			src: "icon145.png",
			sizes: "145x145",
		},
	});
});

test("Should return biggest manifest icon in array", async () => {
	const largestManifestIcon = getLargestManifestIcon({
		icons: [
			{
				src: "icon48.png",
				sizes: "48x48",
				type: "image/png",
			},
			{
				src: "icon72.png",
				sizes: "72x72",
				type: "image/png",
			},
			{
				src: "icon145.png",
				sizes: "145x145",
				type: "image/png",
			},
		],
	});

	expect(largestManifestIcon).toEqual({
		size: 145,
		icon: {
			src: "icon145.png",
			sizes: "145x145",
			type: "image/png",
		},
	});
});
