import type { FastifyPluginAsync } from "fastify";
import { env } from "@playfulprogramming/common";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "@sinclair/typebox";

const CollectionsQueryParamsSchema = Type.Object({
	locale: Type.String({ default: "en" }),
	page: Type.Number(),
	limit: Type.Number(),
	author: Type.String(),
});

const Author = Type.Object({
	id: Type.String(),
	name: Type.String(),
	profileImage: Type.Union([Type.String(), Type.Null()]),
});

const CollectionsResponseSchema = Type.Array(
	Type.Object(
		{
			coverUrl: Type.Union([Type.String(), Type.Null()]),
			title: Type.String(),
			description: Type.String(),
			authors: Type.Array(Author),
			chapterCount: Type.Number(),
		},
		{
			// TODO: update coverUrl and profileImage fields according to feedback
			examples: [
				{
					coverUrl: "?",
					title: "Pragmatic Advice for Teams",
					description:
						"Practical guidance for engineering management and team building.n",
					authors: [
						{
							id: "crutchcorn",
							name: "Corbin Crutchley",
							profileImage: "?",
						},
					],
					chapterCount: 2,
				},
				{
					coverUrl: "?",
					title: "Harsh Leadership Truths",
					description:
						"Exploring the often overlooked and uncomfortable realities of engineering leadership.",
					authors: [
						{
							id: "crutchcorn",
							name: "Corbin Crutchley",
							profileImage: "?",
						},
					],
					chapterCount: 1,
				},
			],
		},
	),
);

function createImageUrl(path: string): string {
	const s3PublicUrl = `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/`;
	return new URL(path, s3PublicUrl).toString();
}

const collectionsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get<{
		Querystring: Static<typeof CollectionsQueryParamsSchema>;
		Reply: Static<typeof CollectionsResponseSchema>;
	}>(
		"/content/collections",
		{
			schema: {
				description: "Fetch a list of collections",
				querystring: CollectionsQueryParamsSchema,
				response: {
					200: {
						description: "Successful",
						content: {
							"application/json": {
								schema: CollectionsResponseSchema,
							},
						},
					},
				},
			},
		},
		async (request, reply) => {
			const queryParams = request.query;

			const result = await db.query.collections.findMany({
				where: {
					authors: {
						slug: queryParams.author,
					},
				},
				limit: queryParams.limit,
				offset: queryParams.limit * queryParams.page,
			});

			const collections: Static<typeof CollectionsResponseSchema> = [];
			for (const { slug } of result) {
				const collection = await db.query.collectionData.findFirst({
					where: {
						locale: queryParams.locale,
						slug,
					},
				});

				const collectionAuthors = await db.query.collectionAuthors.findMany({
					where: { collectionSlug: slug },
				});

				const authors: Static<typeof Author>[] = [];
				for (const { authorSlug } of collectionAuthors) {
					const author = await db.query.profiles.findFirst({
						where: { slug: authorSlug },
					});

					if (author) {
						authors.push({
							id: author.slug,
							name: author.name,
							profileImage: author.profileImage
								? createImageUrl(author.profileImage)
								: null,
						});
					}
				}

				const chapterCount = (
					await db.query.posts.findMany({
						where: {
							collectionSlug: slug,
						},
					})
				).length;

				if (collection) {
					collections.push({
						title: collection.title,
						description: collection.description,
						coverUrl: collection.coverImage
							? createImageUrl(collection.coverImage)
							: null,
						authors,
						chapterCount,
					});
				}
			}

			reply.code(200);
			reply.send(collections);
		},
	);
};

export default collectionsRoutes;
