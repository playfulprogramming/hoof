import type satori from "satori";
import type { PostImageInput } from "../../common/src/index.ts";

export type LayoutFunction = (
	post: PostImageInput,
) => Promise<Parameters<typeof satori>[0]>;
