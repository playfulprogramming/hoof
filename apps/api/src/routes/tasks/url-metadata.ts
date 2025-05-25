import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import {
	type UrlMetadataInput,
	type UrlMetadataOutput,
	UrlMetadataInputSchema,
	env,
} from "@playfulprogramming/common";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "@sinclair/typebox";
import { queueEvents, queues } from "../../utils/queues.ts";

const ImageSchema = Type.Object({
	src: Type.String(),
	width: Type.Optional(Type.Number()),
	height: Type.Optional(Type.Number()),
});

const UrlMetadataResponseSchema = Type.Object(
	{
		title: Type.Optional(Type.String()),
		icon: Type.Optional(ImageSchema),
		banner: Type.Optional(ImageSchema),
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

function mapImageData(
	key: string,
	width: number | null,
	height: number | null,
): Static<typeof ImageSchema> {
	const s3PublicUrl = `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/`;
	const src = new URL(key, s3PublicUrl).toString();
	return {
		src,
		width: width || undefined,
		height: height || undefined,
	};
}

function mapUrlMetadata(
	result: UrlMetadataOutput,
): Static<typeof UrlMetadataResponseSchema> {
	return {
		title: result.title || undefined,
		icon: result.iconKey
			? mapImageData(result.iconKey, result.iconWidth, result.iconHeight)
			: undefined,
		banner: result.bannerKey
			? mapImageData(result.bannerKey, result.bannerWidth, result.bannerHeight)
			: undefined,
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
				throw new Error(`Protocol '${inputUrl.protocol}' is not spported!`);
			}

			const normalizedUrl = new URL(
				inputUrl.pathname,
				inputUrl.origin.toLowerCase(),
			).toString();

			const result = await db.query.urlMetadata.findFirst({
				where: (metadata) => eq(metadata.url, normalizedUrl),
			});

			if (result) {
				reply.code(200);
				reply.send(mapUrlMetadata(result));
				return;
			}

			const job = await queues["url-metadata"].add(
				normalizedUrl,
				{
					...request.body,
					url: normalizedUrl,
				},
				{
					deduplication: {
						id: normalizedUrl,
					},
				},
			);

			const jobResult = await job.waitUntilFinished(
				queueEvents["url-metadata"]!,
				10 * 1000,
			);

			reply.code(200);
			reply.send(mapUrlMetadata(jobResult));
		},
	);
};

export default urlMetadataRoutes;
