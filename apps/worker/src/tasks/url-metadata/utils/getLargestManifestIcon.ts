interface ManifestIcon {
	src: string;
	sizes: string;
	type?: string;
}

interface Manifest {
	name?: string;
	short_name?: string;
	theme_color?: string;
	background_color?: string;
	icons?: Array<ManifestIcon> | Record<string, string>;
}

const parseManifestIconSrcString = (str: string) => {
	const iconSizes = str.split(" ");
	return iconSizes.map((iconSizeStr) => {
		if (!Number.isNaN(Number(iconSizeStr))) return Number(iconSizeStr);
		const splitNumber = Number(iconSizeStr.split("x")[0]);
		if (!Number.isNaN(splitNumber)) return splitNumber;
		return -Infinity;
	});
};

interface ManifestIconResult {
	src: URL;
	size: number;
}

export const getLargestManifestIcon = (
	manifestUrl: URL,
	manifest: Manifest,
) => {
	if (!manifest.icons) return [];

	let manifestIcons: ManifestIconResult[];

	if (Array.isArray(manifest.icons)) {
		manifestIcons = manifest.icons.map((icon) => ({
			src: new URL(icon.src, manifestUrl),
			size: Math.max(...parseManifestIconSrcString(icon.sizes)),
		}));
	} else {
		manifestIcons = Object.entries(manifest.icons)
			.map(([sizes, src]) => ({ sizes, src }))
			.map((icon) => ({
				src: new URL(icon.src, manifestUrl),
				size: Math.max(...parseManifestIconSrcString(icon.sizes)),
			}));
	}

	manifestIcons.sort((a, b) => b.size - a.size);
	return manifestIcons;
};
