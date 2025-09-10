import { banner, createPostImage } from "../src/index.ts";
import looksSame from "looks-same";
import { mockPostData } from "./utils.ts";

test("Should render the expected banner image", async () => {
	const buffer = await createPostImage(banner, await mockPostData());

	const snapshot = "./tests/banner.png";
	// await (await import("fs/promises")).writeFile(snapshot, buffer);

	const { equal } = await looksSame(snapshot, buffer, {
		ignoreAntialiasing: true,
	});
	expect(equal).toEqual(true);
});
