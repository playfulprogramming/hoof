import htm from "xhtm";

export const html = htm.bind((type, props, ...children) => ({
	type,
	props: {
		children,
		...props,
	},
}));
