import { extractMarkdownExcerpt } from "./extractMarkdownExcerpt.ts";

test("extracts a plaintext excerpt from various markdown syntax", () => {
	const result = extractMarkdownExcerpt(
		"Hello, **this** _is_ [some](https://example.com) example `markdown` content.\n\nHi.",
		150,
	);
	expect(result).to.equal("Hello, this is some example markdown content. Hi.");
});

test("includes list items in the markdown excerpt", () => {
	const result = extractMarkdownExcerpt(
		"This should be included:\n\n- Item 1\n- Item 2\n- Item 3\n",
		150,
	);
	expect(result).to.equal("This should be included: Item 1 Item 2 Item 3");
});

test("when a the excerpt exceeds the maxLength, an ellipsis is added", () => {
	const result = extractMarkdownExcerpt(
		"This post is over 150 characters, so it should end in an ellipsis.\n\n".repeat(
			3,
		),
		150,
	);
	expect(result).to.equal(
		"This post is over 150 characters, so it should end in an ellipsis. This post is over 150 characters, so it should end in an ellipsis. This post is…",
	);
});
