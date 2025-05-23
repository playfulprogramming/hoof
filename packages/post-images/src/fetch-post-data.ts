import type { Parent } from "unist";
import * as unified from "unified";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import { findAllAfter } from "unist-util-find-all-after";
import { toString } from "hast-util-to-string";
import { type PostImageInput } from "@playfulprogramming/common";
import type { PostImageData } from "./types.ts";
import matter from "gray-matter";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import dayjs from "dayjs";
import sharp from "sharp";

const stringifyCodeTree: unified.Plugin<unknown[], Parent, string> =
	function () {
		this.compiler = function (tree) {
			// extract code snippets from parsed markdown
			const nodes = findAllAfter(tree as unknown as Parent, 0, {
				tagName: "pre",
			});

			// join code parts into one element
			const value =
				nodes
					.map((node) => toString(node))
					.join("\n")
					.trim() +
				"\n" +
				fetchPostData.toString().replace(/([;,])/g, (s) => s + "\n");

			return (
				value
					.split("\n")
					.filter((s) => !!s)
					// resvg will just outright crash if you throw too many code snippets at it
					.slice(0, 40)
					.join("\n")
			);
		};
	};

const unifiedChain = unified
	.unified()
	.use(remarkParse)
	.use(remarkToRehype, { allowDangerousHtml: true })
	.use(stringifyCodeTree);

// TODO: This is temporary, and should be replaced after https://github.com/playfulprogramming/hoof/issues/18
// (at which point posts should be queried from the database instead)
const rawUrlPrefix =
	"https://raw.githubusercontent.com/playfulprogramming/playfulprogramming/refs/heads/main/";

const RawPostInfo = Type.Object({
	title: Type.String(),
	published: Type.String(),
	authors: Type.Optional(Type.Array(Type.String())),
	tags: Type.Optional(Type.Array(Type.String())),
});

const RawAuthorInfo = Type.Object({
	name: Type.String(),
	profileImg: Type.String(),
});

const TagsInfo = Type.Record(
	Type.String(),
	Type.Object({
		displayName: Type.String(),
		image: Type.Optional(Type.String()),
		emoji: Type.Optional(Type.String()),
		shownWithBranding: Type.Optional(Type.Boolean()),
	}),
);

/**
 * This whole function is temporary, and only exists to get the post data from the slug/path in the
 * interim of having posts imported to a database.
 * (this way we can ensure that input is only accepted from files merged into the playful repository,
 * and someone can't just create/overwrite post images by hitting the endpoint with their own data)
 *
 * Once https://github.com/playfulprogramming/hoof/issues/18 is complete, the only input needed will
 * be the post slug, and all data can be fetched from the db instead.
 */
export async function fetchPostData(
	input: PostImageInput,
): Promise<PostImageData> {
	const indexUrl = new URL(input.path, rawUrlPrefix);
	if (!indexUrl.toString().startsWith(rawUrlPrefix))
		throw new Error(
			`Path '${input.path}' is not a subpath of ${rawUrlPrefix}.`,
		);

	const indexString = await fetch(indexUrl).then((r) => r.text());
	const { data, content } = matter(indexString);
	const indexInfo = Value.Parse(RawPostInfo, data);

	const wordCount = content.split(/\s+/).length;
	const code = (await unifiedChain.process(content)).value.toString();

	const authorIds = indexInfo.authors ?? [input.author];
	const authors = await Promise.all(
		authorIds.map(async (authorId) => {
			const authorUrl = new URL(`content/${authorId}/index.md`, rawUrlPrefix);
			const text = await fetch(authorUrl).then((r) => r.text());
			const { data } = matter(text);
			const info = Value.Parse(RawAuthorInfo, data);

			const imageUrl = new URL(info.profileImg, authorUrl);
			const image = await fetch(imageUrl).then((r) => r.arrayBuffer());
			const buffer = await sharp(image)
				.resize(90, 90)
				.jpeg({ mozjpeg: true })
				.toBuffer();

			return {
				name: info.name,
				// resolve the author's profileImg relative to index.md
				image: "data:image/jpeg;base64," + buffer.toString("base64"),
			};
		}),
	);

	const tagsJson = await fetch(new URL("content/data/tags.json", rawUrlPrefix))
		.then((r) => r.json())
		.then((json) => Value.Parse(TagsInfo, json));
	const tags = (indexInfo.tags ?? [])
		.map((tagId) => tagsJson[tagId])
		.filter((tag) => tag?.emoji || (tag?.image && tag.shownWithBranding));

	return {
		slug: input.slug,
		title: indexInfo.title,
		authors,
		tags,
		wordCount,
		code,
		publishedMeta: dayjs(indexInfo.published).format("MMMM D, YYYY"),
	};
}
