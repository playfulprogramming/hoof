import type { FastifyPluginAsync } from "fastify";
import { db, posts } from "@playfulprogramming/db";
import { Type, type Static } from "typebox";
import { eq } from "drizzle-orm";
import { createImageUrl } from "../../utils.ts";

const CollectionsQueryParamsSchema = Type.Object({
	locale: Type.String({ default: "en" }),
	branch: Type.String({ default: "main" }),
	page: Type.Number({ minimum: 0 }),
	limit: Type.Number({ minimum: 1 }),
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
				where: {
					locale: queryParams.locale,
					branch: queryParams.branch,
					authors: queryParams.author
						? { slug: queryParams.author }
						: undefined,
				},
				with: {
					authors: { columns: { slug: true, name: true, profileImage: true } },
				},
				extras: {
					chapterCount: (collectionsTable) =>
						db.$count(posts, eq(posts.collectionSlug, collectionsTable.slug)),
				},
				offset: queryParams.page * queryParams.limit,
				limit: queryParams.limit,
			});

			const collectionsResponse: CollectionsResponse = [];
			for (const collection of collections) {
				const formattedCollection: CollectionsResponse[number] = {
					slug: collection.slug,
					coverUrl: collection.coverImage
						? createImageUrl(collection.coverImage)
						: undefined,
					title: collection.title,
					description: collection.description,
					chapterCount: collection.chapterCount,
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
