import { readFile } from "fs/promises";
import { html } from "../html.ts";
import type { LayoutFunction, PostImageData } from "../types.ts";

const path = import.meta
	.resolve("../assets/playfulprogramming_sticker.svg")
	.replace(/^file:\/\//, "");
const playfulProgrammingStickerSvg = await readFile(path, "utf-8");
const playfulProgrammingSticker = `data:image/svg+xml,${encodeURIComponent(playfulProgrammingStickerSvg)}`;

function code(post: PostImageData) {
	return html`
		<div
			style=${{
				width: "100%",
				height: "200%",
				display: "flex",
				flexDirection: "row",
				position: "absolute",
				top: 0,
				left: 0,
				background: "hsl(205 100% 60%)",
				opacity: 0.5,
				borderRadius: 8,
				padding: "24px 48px",
				fontFamily: "Roboto Mono",
				fontWeight: 700,
				fontSize: "28px",
				boxShadow: "0 0 48px hsl(205 100% 30%)",
			}}
		>
			<pre
				style=${{
					width: 64,
					filter: "blur(1px)",
					color: "#fffa",
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
					color: "#fff",
					fontFamily: "Roboto Mono",
				}}
			>
${post.code}</pre
			>
		</div>
	`;
}

export const linkPreview: LayoutFunction = async (post) => {
	const transforms = [
		"translateX(150px) scaleY(0.7) skew(15deg, -10deg)",
		"translateX(-50px) scaleY(0.7) skew(-15deg, 10deg)",
		"scaleX(0.8) skew(10deg, 10deg)",
	];

	const transform = transforms[post.title.length % transforms.length];

	return html`
		<div
			style="${{
				width: "100%",
				height: "100%",
				display: "flex",
				background: "hsl(205 100% 73%)",
				fontFamily: "Figtree, 'Noto Emoji'",
			}}"
		>
			<div
				style="${{
					width: "100%",
					height: "100%",
					display: "flex",
					background: "#66bfff99",
				}}"
			>
				<div
					style=${{
						display: "flex",
						position: "absolute",
						top: -150,
						left: 0,
						transform,
						width: "100%",
						height: "200%",
						maskImage: "linear-gradient(to left, #66bfff00 10%, #66bfffff)",
					}}
				>
					${code(post)}
				</div>
				<div
					style="${{
						width: "100%",
						height: "100%",
						display: "flex",
						background:
							"radial-gradient(ellipse 100% 100% at bottom left, #C8E6FF, #C8E6FFA8 50%, #C8E6FF00)",
					}}"
				>
					<div
						style=${{
							display: "flex",
							position: "absolute",
							top: 64,
							right: 64,
							fontWeight: 700,
							fontSize: "36px",
							color: "#00344D",
							backgroundColor: "#C8E6FF",
							padding: "18px 32px",
							borderRadius: "64px",
						}}
					>
						playfulprogramming.com
					</div>
					<div
						style=${{
							display: "flex",
							width: "90%",
							position: "absolute",
							left: 64,
							bottom: 120 + 56 + 42,
							fontWeight: 800,
							fontSize: "72px",
							color: "#00344D",
							WebkitTextStrokeWidth: 14,
							WebkitTextStrokeColor: "#E5F2FF",
						}}
					>
						${post.title}
					</div>
					${post.authors
						.map((author, index) => [author, index] as const)
						.reverse()
						.map(
							([author, index]) => html`
								<img
									style=${{
										width: 102,
										height: 102,
										position: "absolute",
										left: 64 + index * 52,
										bottom: 56 + 9,
										border: "6px solid #FFF",
										borderRadius: "50%",
									}}
									src="${author.image}"
								/>
							`,
						)}
					<div
						style=${{
							height: 120,
							width: "60%",
							display: "flex",
							flexDirection: "column",
							justifyContent: "center",
							gap: "4px",
							position: "absolute",
							left: 64 + 102 + 24 + (post.authors.length - 1) * 52,
							bottom: 56,
							fontWeight: 700,
						}}
					>
						<span
							style=${{
								fontSize: "36px",
								color: "#00344D",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							${post.authors.map((a) => a.name).join(", ")}
						</span>
						<span
							style=${{
								fontSize: "32px",
								color: "#006590",
							}}
						>
							${post.publishedMeta}
							<span style=${{ margin: "0 0.5em" }}>·</span>
							${post.wordCount.toLocaleString("en") + " words"}
						</span>
					</div>
					<img
						style=${{
							width: 120,
							height: 120,
							position: "absolute",
							bottom: 56,
							right: 64,
						}}
						src="${playfulProgrammingSticker}"
					/>
				</div>
			</div>
		</div>
	`;
};
