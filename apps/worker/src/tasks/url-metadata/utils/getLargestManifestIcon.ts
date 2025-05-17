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

export const getLargestManifestIcon = (manifest: Manifest) => {
	if (!manifest.icons) return null;

	let largest = {
		size: 0,
		icon: null as ManifestIcon | null,
	};

	if (Array.isArray(manifest.icons)) {
		for (const icon of manifest.icons) {
			for (const size of parseManifestIconSrcString(icon.sizes)) {
				if (size > largest.size) {
					largest = { size, icon };
				}
			}
		}
	} else {
		for (const [sizes, src] of Object.entries(manifest.icons)) {
			const size = parseManifestIconSrcString(sizes)[0];
			if (size > largest.size) {
				largest = {
					size,
					icon: {
						src,
						sizes: `${size}x${size}`,
					},
				};
			}
		}
	}

	return largest;
};
