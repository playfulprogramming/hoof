import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { LayoutFunction, PostImageData } from "./types.ts";
import { readFile } from "fs/promises";
import { importMetaResolve } from "./import-meta-resolve.ts";

const PAGE_WIDTH = 1280;
const PAGE_HEIGHT = 640;

const figtreeRegularTtf = importMetaResolve(
	"./assets/Figtree/Figtree-Regular.ttf",
);
const figtreeSemiBoldTtf = importMetaResolve(
	"./assets/Figtree/Figtree-SemiBold.ttf",
);
const figtreeBoldTtf = importMetaResolve("./assets/Figtree/Figtree-Bold.ttf");
const figtreeExtraBoldTtf = importMetaResolve(
	"./assets/Figtree/Figtree-ExtraBold.ttf",
);
const robotoMonoRegularTtf = importMetaResolve(
	"./assets/Roboto_Mono/RobotoMono-Regular.ttf",
);
const robotoMonoBoldTtf = importMetaResolve(
	"./assets/Roboto_Mono/RobotoMono-Bold.ttf",
);
const notoEmojiTtf = importMetaResolve(
	"./assets/Noto_Emoji/NotoEmoji-Regular.ttf",
);

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
