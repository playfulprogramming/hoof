import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { PostImageInput } from "../../common/src/index.ts";
import type { LayoutFunction } from "./types.ts";
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
const robotoMonoBoldTtf = import.meta
	.resolve("./assets/Roboto_Mono/RobotoMono-Bold.ttf")
	.replace(/^file:\/\//, "");
const _colorEmojiTtf = import.meta.resolve(
	"./assets/NotoColorEmoji/NotoColorEmoji-Regular.ttf",
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
		data: await readFile(robotoMonoBoldTtf),
		weight: 700,
		style: "normal",
	},
];

export async function createPostImage(
	layout: LayoutFunction,
	post: PostImageInput,
): Promise<Buffer> {
	const html = await layout(post);
	const svg = await satori(html, {
		width: PAGE_WIDTH,
		height: PAGE_HEIGHT,
		fonts,
	});

	const resvg = new Resvg(svg);
	return resvg.render().asPng();
}

export * from "./layouts/link-preview.ts";
