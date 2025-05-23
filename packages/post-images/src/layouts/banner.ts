import { readFile } from "fs/promises";
import { html } from "../html.ts";
import type { LayoutFunction, PostImageData } from "../types.ts";

const fallbackStickerPath = import.meta
	.resolve("../assets/role_devops.svg")
	.replace(/^file:\/\//, "");
const fallbackSticker = `data:image/svg+xml,${encodeURIComponent(await readFile(fallbackStickerPath, "utf-8"))}`;

function code(post: PostImageData) {
	return html`
		<div
			style=${{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "row",
				background: "#fffb",
				borderRadius: 8,
				padding: "24px 48px",
				fontFamily: "Roboto Mono",
				fontWeight: 700,
				fontSize: "18px",
			}}
		>
			<pre
				style=${{
					width: 64,
					filter: "blur(1px)",
					color: "#888",
					fontFamily: "Roboto Mono",
				}}
			>
${post.code
					.split("\n")
					.map((_, index) => String(index + 1).padStart(2))
					.join("\n")}</pre
			>
			<pre
				style=${{
					width: "80%",
					filter: "blur(1px)",
					color: "#000",
					fontFamily: "Roboto Mono",
				}}
			>
${post.code}</pre
			>
		</div>
	`;
}

export const banner: LayoutFunction = async (post) => {
	const transforms = ["rotate(25deg)", "rotate(10deg)", "rotate(-25deg)"];

	const transform = transforms[post.title.length % transforms.length];

	const tagSvg = post.tags[0]?.image ?? fallbackSticker;
	const tagEmoji = post.tags[0]?.emoji;
	const tagName = post.tags.length
		? post.tags.map((t) => t.displayName).join(" ")
		: post.title;

	return html`
		<div
			style="${{
				width: "100%",
				height: "100%",
				display: "flex",
				background: "#ededed",
			}}"
		>
			<span
				style=${{
					width: "200%",
					height: "200%",
					position: "absolute",
					padding: "0px 32px",
					top: "-50%",
					left: "-50%",
					transform,
					wordBreak: "break-all",
					fontFamily: "Figtree",
					fontWeight: 700,
					fontSize: "110px",
					color: "#ccc",
					lineHeight: 1.1,
				}}
			>
				${(tagName + " ").repeat(20) ?? ""}
			</span>
			<div
				style=${{
					display: "flex",
					flexDirection: "row",
					position: "absolute",
					top: 0,
					left: "25%",
					transform,
					width: "100%",
					height: "200%",
				}}
			>
				<div
					style=${{
						display: "flex",
						width: 20,
						height: "100%",
						background: "#bbb",
					}}
				/>
				${code(post)}
			</div>
			<div
				style=${{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					textAlign: "center",
					fontFamily: "'Noto Emoji'",
					fontSize: "120px",
					color: "#000",
					width: 200,
					height: 200,
					position: "absolute",
					top: "30%",
					left: "50%",
					transform,
					background: "#eee",
					borderRadius: 16,
					border: "12px solid #fff",
					boxShadow: "0 0 48px #000a",
				}}
			>
				${tagSvg &&
				tagEmoji === undefined &&
				html`
					<img
						width="160"
						height="160"
						style=${{
							width: 160,
							height: 160,
							filter: "grayscale(1)",
						}}
						src=${tagSvg}
					/>
				`}
				${tagEmoji}
			</div>
		</div>
	`;
};
