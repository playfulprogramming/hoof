import { getLargestManifestIcon } from "./getLargestManifestIcon.ts";

const manifestUrl = new URL("https://example.test/subdir/manifest.json");

test("Should return null if no manifest icon found", async () => {
	const largestManifestIcon = getLargestManifestIcon(manifestUrl, {
		name: "Test",
	});

	expect(largestManifestIcon).toEqual([]);
});

test("Should return single manifest icon in array", async () => {
	const largestManifestIcon = getLargestManifestIcon(manifestUrl, {
		icons: [
			{
				src: "icon.png",
				sizes: "48x48",
				type: "image/png",
			},
		],
	});

	expect(largestManifestIcon).toEqual([
		{
			src: new URL("https://example.test/subdir/icon.png"),
			size: 48,
		},
	]);
});

test("Should return single manifest icon in record", async () => {
	const largestManifestIcon = getLargestManifestIcon(manifestUrl, {
		icons: {
			"48x48": "icon.png",
		},
	});

	expect(largestManifestIcon).toEqual([
		{
			src: new URL("https://example.test/subdir/icon.png"),
			size: 48,
		},
	]);
});

test("Should return biggest manifest icon in record", async () => {
	const largestManifestIcon = getLargestManifestIcon(manifestUrl, {
		icons: {
			"48x48": "icon48.png",
			"72x72": "icon72.png",
			"145x145": "icon145.png",
		},
	});

	expect(largestManifestIcon).toEqual([
		{
			src: new URL("https://example.test/subdir/icon145.png"),
			size: 145,
		},
		{
			src: new URL("https://example.test/subdir/icon72.png"),
			size: 72,
		},
		{
			src: new URL("https://example.test/subdir/icon48.png"),
			size: 48,
		},
	]);
});

test("Should return biggest manifest icon in array", async () => {
	const largestManifestIcon = getLargestManifestIcon(manifestUrl, {
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

	expect(largestManifestIcon).toEqual([
		{
			src: new URL("https://example.test/subdir/icon145.png"),
			size: 145,
		},
		{
			src: new URL("https://example.test/subdir/icon72.png"),
			size: 72,
		},
		{
			src: new URL("https://example.test/subdir/icon48.png"),
			size: 48,
		},
	]);
});
