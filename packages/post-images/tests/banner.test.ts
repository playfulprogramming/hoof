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

// Regression coverage for #125: longer, multi-line code should still render
// in the blurred banner background rather than disappearing.
test("Should render long multi-line code in the banner background", async () => {
	const post = await mockPostData();
	post.code = `import { useState, useEffect } from "react";
import type { FC } from "react";

interface Props {
  title: string;
  onSave: (value: string) => void;
}

export const Editor: FC<Props> = ({ title, onSave }) => {
  const [value, setValue] = useState("");

  useEffect(() => {
    console.log("mounted", title);
    return () => console.log("unmounted");
  }, [title]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="submit">Save</button>
    </form>
  );
};`;

	const buffer = await createPostImage(banner, post);

	const snapshot = "./tests/banner-long-code.png";
	// await (await import("fs/promises")).writeFile(snapshot, buffer);

	const { equal } = await looksSame(snapshot, buffer, {
		ignoreAntialiasing: true,
	});
	expect(equal).toEqual(true);
});
