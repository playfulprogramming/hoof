import { createPostImage, linkPreview } from "../src/index.ts";
import looksSame from "looks-same";
import { mockPostData } from "./utils.ts";

test("Should render the expected link-preview image", async () => {
	const buffer = await createPostImage(linkPreview, await mockPostData());

	const snapshot = "./tests/link-preview.png";
	// await (await import("fs/promises")).writeFile(snapshot, buffer);

	const { equal } = await looksSame(snapshot, buffer, {
		ignoreAntialiasing: true,
	});
	expect(equal).toEqual(true);
});
