import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { LayoutFunction, PostImageData } from "./types.ts";
import { readFile } from "fs/promises";

const PAGE_WIDTH = 1280;
const PAGE_HEIGHT = 640;

const figtreeRegularTtf = import.meta
	.resolve("./assets/Figtree/Figtree-Regular.ttf")
	.replace(/^file:\/\//, "");
const figtreeSemiBoldTtf = import.meta
	.resolve("./assets/Figtree/Figtree-SemiBold.ttf")
	.replace(/^file:\/\//, "");
const figtreeBoldTtf = import.meta
	.resolve("./assets/Figtree/Figtree-Bold.ttf")
	.replace(/^file:\/\//, "");
const figtreeExtraBoldTtf = import.meta
	.resolve("./assets/Figtree/Figtree-ExtraBold.ttf")
	.replace(/^file:\/\//, "");
const robotoMonoRegularTtf = import.meta
	.resolve("./assets/Roboto_Mono/RobotoMono-Regular.ttf")
	.replace(/^file:\/\//, "");
const robotoMonoBoldTtf = import.meta
	.resolve("./assets/Roboto_Mono/RobotoMono-Bold.ttf")
	.replace(/^file:\/\//, "");
const notoEmojiTtf = import.meta
	.resolve("./assets/Noto_Emoji/NotoEmoji-Regular.ttf")
	.replace(/^file:\/\//, "");

const fonts: Parameters<typeof satori>[1]["fonts"] = [
	{
		name: "Figtree",
		data: await readFile(figtreeRegularTtf),
		weight: 400,
		style: "normal",
	},
	{
		name: "Figtree",
		data: await readFile(figtreeSemiBoldTtf),
		weight: 600,
		style: "normal",
	},
	{
		name: "Figtree",
		data: await readFile(figtreeBoldTtf),
		weight: 700,
		style: "normal",
	},
	{
		name: "Figtree",
		data: await readFile(figtreeExtraBoldTtf),
		weight: 800,
		style: "normal",
	},
	{
		name: "Roboto Mono",
		data: await readFile(robotoMonoRegularTtf),
		weight: 500,
		style: "normal",
	},
	{
		name: "Roboto Mono",
		data: await readFile(robotoMonoBoldTtf),
		weight: 700,
		style: "normal",
	},
	{
		name: "Noto Emoji",
		data: await readFile(notoEmojiTtf),
	},
];

export async function createPostImage(
	layout: LayoutFunction,
	post: PostImageData,
): Promise<Buffer> {
	const html = await layout(post);
	const svg = await satori(html, {
		width: PAGE_WIDTH,
		height: PAGE_HEIGHT,
		fonts,
	});

	const resvg = new Resvg(svg, {
		font: {
			loadSystemFonts: false,
		},
	});
	return resvg.render().asPng();
}

export * from "./layouts/banner.ts";
export * from "./layouts/link-preview.ts";
export * from "./fetch-post-data.ts";
