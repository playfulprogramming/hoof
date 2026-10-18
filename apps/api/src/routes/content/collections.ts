import type { FastifyPluginAsync } from "fastify";
import { db } from "@playfulprogramming/db";
import { BRANCH_MAIN } from "@playfulprogramming/common";
import { Type, type Static } from "typebox";
import { createImageUrl } from "../../utils.ts";
import {
	BranchQueryParamSchema,
	branchFallbackFilter,
	branchesWithFallback,
	pickBranchRows,
} from "./common.ts";

const CollectionsQueryParamsSchema = Type.Object({
	locale: Type.String({ default: "en" }),
	branch: BranchQueryParamSchema,
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
			const { locale, branch } = queryParams;

			// Every slug on the requested branch: a branch row always wins over main's.
			const branchSlugs =
				branch === BRANCH_MAIN
					? []
					: (
							await db.query.collections.findMany({
								columns: { slug: true },
								where: { locale, branch },
							})
						).map((row) => row.slug);

			// Every post slug on the requested branch, published or not, so a chapter
			// the branch moved elsewhere or unpublished is not counted from main.
			const branchPostSlugs =
				branch === BRANCH_MAIN
					? []
					: (
							await db.query.posts.findMany({
								columns: { slug: true },
								where: { locale, branch },
							})
						).map((row) => row.slug);

			const relatedBranches = { in: branchesWithFallback(branch) };

			const collections = await db.query.collections.findMany({
				where: {
					locale,
					...branchFallbackFilter(branch, branchSlugs),
					authors: queryParams.author
						? { slug: queryParams.author }
						: undefined,
				},
				with: {
					authors: {
						columns: {
							slug: true,
							branch: true,
							name: true,
							profileImage: true,
						},
						where: { branch: relatedBranches },
					},
					posts: {
						columns: { slug: true },
						where: {
							locale,
							...branchFallbackFilter(branch, branchPostSlugs),
							publishedAt: { isNotNull: true },
						},
					},
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
					// Same chapter rule as /content/post/:slug.
					chapterCount: collection.posts.length,
					authors: [],
				};

				for (const author of pickBranchRows(collection.authors, branch)) {
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
