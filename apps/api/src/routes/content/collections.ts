import type { FastifyPluginAsync } from "fastify";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "@sinclair/typebox";

const CollectionsParamsSchema = Type.Object({
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
			examples: [
				// TODO: update them
				{
					banner:
						"http://localhost:9000/hoof-storage/post-images/example.banner.png",
					linkPreview:
						"http://localhost:9000/hoof-storage/post-images/example.link-preview.png",
				},
			],
		},
	),
);

const collectionsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get<{
		Params: Static<typeof CollectionsParamsSchema>;
		Reply: Static<typeof CollectionsResponseSchema>;
	}>(
		"/content/collections",
		{
			schema: {
				description: "Fetch a list of collections",
				params: CollectionsParamsSchema,
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
			const params = request.params;

			const result = await db.query.collections.findMany({
				where: {
					authors: {
						slug: params.author,
					},
				},
				limit: params.limit,
				offset: params.limit * params.page,
			});

			const collections: Static<typeof CollectionsResponseSchema> = [];
			for (const { slug } of result) {
				const collection = await db.query.collectionData.findFirst({
					where: {
						locale: params.locale,
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
							profileImage: author.profileImage,
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
						coverUrl: collection.coverImage,
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
