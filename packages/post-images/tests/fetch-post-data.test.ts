import fs from "fs/promises";
import { afterEach, vi } from "vitest";
import { fetchPostData } from "../src/fetch-post-data.ts";

const RAW_PREFIX =
	"https://raw.githubusercontent.com/playfulprogramming/playfulprogramming/refs/heads/main/";

const AUTHOR_MD = [
	"---",
	'name: "Fake Author"',
	'profileImg: "profile.png"',
	"---",
	"",
].join("\n");

const TAGS_JSON = "{}";

afterEach(() => {
	vi.unstubAllGlobals();
});

test("fetches and assembles post image data for the example post fixture", async () => {
	const examplePostMd = await fs.readFile(
		"./tests/fixtures/example-post.md",
		"utf-8",
	);
	const profileImage = await fs.readFile("./tests/profile.png");

	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string | URL) => {
			const url = input.toString();

			if (url === `${RAW_PREFIX}content/fennifith/posts/example/index.md`) {
				return new Response(examplePostMd);
			}
			if (url === `${RAW_PREFIX}content/fennifith/index.md`) {
				return new Response(AUTHOR_MD);
			}
			if (url === `${RAW_PREFIX}content/fennifith/profile.png`) {
				return new Response(profileImage);
			}
			if (url === `${RAW_PREFIX}content/data/tags.json`) {
				return new Response(TAGS_JSON);
			}

			throw new Error(`Unexpected fetch call in test: ${url}`);
		}),
	);

	const result = await fetchPostData({
		slug: "example",
		author: "fennifith",
		path: "content/fennifith/posts/example/index.md",
	});

	expect(result.slug).toEqual("example");
	expect(result.title).toEqual("Example Post");
	expect(result.publishedMeta).toEqual("September 18, 1999");
	expect(result.tags).toEqual([]);
	expect(result.authors).toEqual([
		{
			name: "Fake Author",
			image: expect.stringMatching(/^data:image\/jpeg;base64,/),
		},
	]);

	// NOTE: findAllAfter(tree, 0, { tagName: "pre" }) only walks top-level siblings,
	// so it does not descend into `pre` elements nested inside blockquotes or list
	// items. The example post deliberately includes code blocks inside a blockquote
	// and inside both an unordered and an ordered list item; those are silently
	// dropped from `code` below. This is the known, current behavior being captured
	// as a baseline here, not a fix - see https://github.com/playfulprogramming/hoof/issues/212
	// for descending into nested code blocks.
	expect(result.code).toMatchSnapshot();
});
