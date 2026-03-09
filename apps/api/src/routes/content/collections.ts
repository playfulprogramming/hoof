import type { FastifyPluginAsync } from "fastify";
import { env } from "@playfulprogramming/common";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "typebox";

const CollectionsQueryParamsSchema = Type.Object({
	locale: Type.String({ default: "en" }),
	page: Type.Number(),
	limit: Type.Number(),
	author: Type.Optional(Type.String()),
});

const CollectionsResponseSchema = Type.Array(
	Type.Object(
		{
			slug: Type.String(),
			coverUrl: Type.Optional(Type.String()),
			title: Type.String(),
			description: Type.String(),
			chapterCount: Type.Number(),
			authors: Type.Array(
				Type.Object({
					id: Type.String(),
					name: Type.String(),
					profileImageUrl: Type.Optional(Type.String()),
				}),
			),
		},
		{
			examples: [
				{
					slug: "pragmatic-advice-for-teams",
					coverUrl: "https://example.test/cover.png",
					title: "Pragmatic Advice for Teams",
					description:
						"Practical guidance for engineering management and team building.",
					authors: [
						{
							id: "crutchcorn",
							name: "Corbin Crutchley",
							profileImageUrl: "https://example.test/profile.jpg",
						},
					],
					chapterCount: 2,
				},
				{
					slug: "harsh-leadership-truths",
					coverUrl: "https://example.test/cover.png",
					title: "Harsh Leadership Truths",
					description:
						"Exploring the often overlooked and uncomfortable realities of engineering leadership.",
					authors: [
						{
							id: "crutchcorn",
							name: "Corbin Crutchley",
							profileImageUrl: "https://example.test/profile.jpg",
						},
						{
							id: "fennifith",
							name: "James Fenn",
							profileImageUrl: "https://example.test/profile.jpg",
						},
					],
					chapterCount: 5,
				},
			],
		},
	),
);

type CollectionsResponse = Static<typeof CollectionsResponseSchema>;

function createImageUrl(path: string): string {
	const s3PublicUrl = `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/`;
	return new URL(path, s3PublicUrl).toString();
}

const collectionsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get<{
		Querystring: Static<typeof CollectionsQueryParamsSchema>;
		Reply: CollectionsResponse;
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

			const collections = await db.query.collections.findMany({
				where: { authors: { slug: queryParams.author } },
				with: {
					data: {
						columns: { coverImage: true, title: true, description: true },
						where: { locale: queryParams.locale },
					},
					posts: { columns: { collectionOrder: true } }, // Only get minimum data, will be only used for counting `chapterCount`
					authors: { columns: { slug: true, name: true, profileImage: true } },
				},
				limit: queryParams.limit,
				offset: queryParams.limit * queryParams.page,
			});

			const collectionsResponse: CollectionsResponse = [];
			for (const collection of collections) {
				const collectionData = collection.data[0];
				const formattedCollection: CollectionsResponse[number] = {
					slug: collection.slug,
					coverUrl: collectionData.coverImage
						? createImageUrl(collectionData.coverImage)
						: undefined,
					title: collectionData.title,
					description: collectionData.description,
					chapterCount: collection.posts.length,
					authors: [],
				};

				for (const author of collection.authors) {
					formattedCollection.authors.push({
						id: author.slug,
						name: author.name,
						profileImageUrl: author.profileImage
							? createImageUrl(author.profileImage)
							: undefined,
					});
				}

				collectionsResponse.push(formattedCollection);
			}

			reply.code(200);
			reply.send(collectionsResponse);
		},
	);
};

export default collectionsRoutes;
