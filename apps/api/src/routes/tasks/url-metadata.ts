import type { FastifyPluginAsync } from "fastify";
import { env } from "@playfulprogramming/common";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "typebox";
import {
	type UrlMetadataInput,
	Tasks,
	UrlMetadataInputSchema,
	createJob,
} from "@playfulprogramming/bullmq";

type UrlMetadataDbResult = NonNullable<
	Awaited<ReturnType<typeof db.query.urlMetadata.findFirst>>
>;

const ImageSchema = Type.Object({
	src: Type.String(),
	width: Type.Optional(Type.Number()),
	height: Type.Optional(Type.Number()),
	altText: Type.Optional(Type.String()),
});

const GistSchema = Type.Object({
	username: Type.String(),
	description: Type.Optional(Type.String()),
	files: Type.Array(
		Type.Object({
			filename: Type.String(),
			contentUrl: Type.String(),
			language: Type.String(),
		}),
		{
			minItems: 1,
		},
	),
});

const PostSchema = Type.Object({
	author: Type.Object({
		name: Type.String(),
		handle: Type.String(),
		avatar: Type.Optional(ImageSchema),
	}),
	content: Type.String(),
	url: Type.String(),
	image: Type.Optional(ImageSchema),
	numLikes: Type.Optional(Type.Number()),
	numReposts: Type.Optional(Type.Number()),
	numReplies: Type.Optional(Type.Number()),
	createdAt: Type.String(),
});

const EmbedGistSchema = Type.Object(
	{
		type: Type.Literal("gist"),
		gist: Type.Optional(GistSchema),
	},
	{ title: "gist" },
);

const EmbedPostSchema = Type.Object(
	{
		type: Type.Literal("post"),
		post: Type.Optional(PostSchema),
	},
	{ title: "post" },
);

const EmbedVideoSchema = Type.Object(
	{
		type: Type.Literal("video"),
		src: Type.Optional(Type.String()),
		width: Type.Optional(Type.Number()),
		height: Type.Optional(Type.Number()),
	},
	{ title: "video" },
);

const UrlMetadataResponseSchema = Type.Object(
	{
		title: Type.Optional(Type.String()),
		icon: Type.Optional(ImageSchema),
		banner: Type.Optional(ImageSchema),
		embed: Type.Optional(
			Type.Union([EmbedGistSchema, EmbedPostSchema, EmbedVideoSchema]),
		),
		error: Type.Boolean(),
	},
	{
		examples: [
			{
				title: "Homepage | Playful Programming",
				icon: {
					src: "http://localhost:9000/hoof-storage/remote-icon-b4dcfb60d116d9a1af3a3c151dd7b1ce.png",
					width: 24,
					height: 24,
				},
				banner: {
					src: "http://localhost:9000/hoof-storage/remote-banner-e1d1aca0d6ccd594d4f68ac95f1a32e2.png",
					width: 896,
					height: 448,
				},
				error: false,
			},
		],
	},
);

function mapObjectKey(key: string): string {
	const s3PublicUrl = `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/`;
	return new URL(key, s3PublicUrl).toString();
}

function mapImageData(
	key: string | null,
	width: number | null,
	height: number | null,
	altText?: string | null,
): Static<typeof ImageSchema> | undefined {
	if (!key) return undefined;
	return {
		src: mapObjectKey(key),
		width: width || undefined,
		height: height || undefined,
		altText: altText || undefined,
	};
}

async function mapEmbedGist(
	gistId: string,
): Promise<Static<typeof GistSchema> | undefined> {
	const gist = await db.query.urlMetadataGist.findFirst({ where: { gistId } });
	if (!gist) return undefined;

	const gistFiles = await db.query.urlMetadataGistFile.findMany({
		where: { gistId },
	});

	if (gistFiles.length === 0) return undefined;

	return {
		username: gist.username,
		description: gist.description || undefined,
		files: gistFiles.map((file) => ({
			filename: file.filename,
			contentUrl: mapObjectKey(file.contentKey),
			language: file.language,
		})),
	};
}

async function mapEmbedPost(
	postId: string,
): Promise<Static<typeof PostSchema> | undefined> {
	const post = await db.query.urlMetadataPost.findFirst({ where: { postId } });
	if (!post) return undefined;

	return {
		author: {
			name: post.authorName,
			handle: post.authorHandle,
			avatar: mapImageData(post.avatarKey, post.avatarWidth, post.avatarHeight),
		},
		content: post.content,
		url: post.url,
		image: mapImageData(
			post.imageKey,
			post.imageWidth,
			post.imageHeight,
			post.imageAltText,
		),
		numLikes: post.numLikes !== null ? post.numLikes : undefined,
		numReplies: post.numReplies !== null ? post.numReplies : undefined,
		numReposts: post.numReposts !== null ? post.numReposts : undefined,
		createdAt: post.createdAt.toISOString(),
	};
}

function mapEmbedVideo(
	result: UrlMetadataDbResult,
): Static<typeof EmbedVideoSchema> {
	return {
		type: "video",
		src: result.embedSrc || undefined,
		width: result.embedWidth || undefined,
		height: result.embedHeight || undefined,
	};
}

async function mapEmbed(
	result: UrlMetadataDbResult,
): Promise<Static<typeof UrlMetadataResponseSchema>["embed"]> {
	if (result.embedType === "post") {
		return {
			type: "post",
			post: result.postId ? await mapEmbedPost(result.postId) : undefined,
		};
	}
	if (result.embedType === "gist") {
		return {
			type: "gist",
			gist: result.gistId ? await mapEmbedGist(result.gistId) : undefined,
		};
	}
	if (result.embedType === "video") {
		return mapEmbedVideo(result);
	}
	return undefined;
}

function mapUrlMetadata(
	result: UrlMetadataDbResult,
): Static<typeof UrlMetadataResponseSchema> {
	return {
		title: result.title || undefined,
		icon: mapImageData(result.iconKey, result.iconWidth, result.iconHeight),
		banner: mapImageData(
			result.bannerKey,
			result.bannerWidth,
			result.bannerHeight,
		),
		error: result.error,
	};
}

const urlMetadataRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{
		Body: UrlMetadataInput;
		Reply: Static<typeof UrlMetadataResponseSchema>;
	}>(
		"/tasks/url-metadata",
		{
			schema: {
				description:
					"Fetch and cache metadata for a given URL, including the page title, icon, and banner image.",
				body: UrlMetadataInputSchema,
				response: {
					200: {
						description: "Task complete",
						content: {
							"application/json": {
								schema: UrlMetadataResponseSchema,
							},
						},
					},
				},
			},
		},
		async (request, reply) => {
			// Normalize URL
			const inputUrl = new URL(request.body.url);
			if (!["http:", "https:"].includes(inputUrl.protocol)) {
				throw new Error(`Protocol '${inputUrl.protocol}' is not supported!`);
			}

			const normalizedUrl = new URL(
				inputUrl.pathname + inputUrl.search,
				inputUrl.origin.toLowerCase(),
			).toString();

			const result = await db.query.urlMetadata.findFirst({
				where: { url: normalizedUrl },
			});

			let shouldSubmitJob = false;

			if (result) {
				// if 30 days has passed after metadata was last fetched, revalidate it
				const stale = new Date(
					result.fetchedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
				);
				if (result.error || new Date() > stale) {
					shouldSubmitJob = true;
				}

				const response = {
					...mapUrlMetadata(result),
					embed: await mapEmbed(result),
				};

				reply.code(200);
				reply.send(response);
			} else {
				shouldSubmitJob = true;
				reply.code(201);
			}

			if (shouldSubmitJob) {
				await createJob(Tasks.URL_METADATA, normalizedUrl, {
					...request.body,
					url: normalizedUrl,
				});
			}
		},
	);
};

export default urlMetadataRoutes;
