import type { FastifyPluginAsync } from "fastify";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "typebox";
import { createImageUrl } from "../../utils.ts";

const PostParamsSchema = Type.Object({
	slug: Type.String(),
});

const PostQueryParamsSchema = Type.Object({
	locale: Type.String({ default: "en" }),
	branch: Type.String({ default: "main" }),
});

const PostResponseSchema = Type.Object(
	{
		slug: Type.String(),
		title: Type.String(),
		description: Type.String(),
		bannerUrl: Type.Optional(Type.String()),
		socialImageUrl: Type.Optional(Type.String()),
		wordCount: Type.Number(),
		publishedAt: Type.Optional(Type.String({ format: "date-time" })),
		authors: Type.Array(
			Type.Object({
				id: Type.String(),
				name: Type.String(),
				profileImageUrl: Type.Optional(Type.String()),
			}),
		),
		collection: Type.Optional(
			Type.Object({
				slug: Type.String(),
				title: Type.String(),
				chapters: Type.Array(
					Type.Object({
						slug: Type.String(),
						title: Type.String(),
					}),
				),
			}),
		),
	},
	{
		examples: [
			{
				slug: "example-post",
				title: "Example Post",
				description: "A test post",
				bannerUrl: "https://example.test/banner.png",
				socialImageUrl: "https://example.test/social.png",
				wordCount: 1200,
				publishedAt: "2024-01-15T00:00:00.000Z",
				authors: [
					{
						id: "crutchcorn",
						name: "Corbin Crutchley",
						profileImageUrl: "https://example.test/profile.jpg",
					},
				],
				collection: {
					slug: "example-collection",
					title: "Example Collection",
					chapters: [
						{ slug: "example-post", title: "Example Post" },
						{ slug: "example-post-2", title: "Example Post 2" },
					],
				},
			},
		],
	},
);

type PostResponse = Static<typeof PostResponseSchema>;

const PostErrorResponseSchema = Type.Object({
	error: Type.String(),
});

const postRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get<{
		Params: Static<typeof PostParamsSchema>;
		Querystring: Static<typeof PostQueryParamsSchema>;
		Reply: PostResponse | { error: string };
	}>(
		"/content/post/:slug",
		{
			schema: {
				description:
					"Fetch a single post, its authors, and its collection chapter list",
				params: PostParamsSchema,
				querystring: PostQueryParamsSchema,
				response: {
					200: {
						description: "Successful",
						content: {
							"application/json": { schema: PostResponseSchema },
						},
					},
					404: {
						description: "Post not found",
						content: {
							"application/json": { schema: PostErrorResponseSchema },
						},
					},
				},
			},
		},
		async (request, reply) => {
			const { slug } = request.params;
			const { locale, branch } = request.query;

			const post = await db.query.posts.findFirst({
				where: { slug, locale, branch },
				columns: {
					slug: true,
					title: true,
					description: true,
					bannerImage: true,
					socialImage: true,
					wordCount: true,
					publishedAt: true,
				},
				with: {
					authors: { columns: { slug: true, name: true, profileImage: true } },
					collection: {
						with: {
							data: {
								columns: { title: true },
								where: { locale },
							},
							posts: {
								columns: {
									slug: true,
									collectionOrder: true,
									title: true,
									publishedAt: true,
								},
								where: { locale, branch },
							},
						},
					},
				},
			});

			if (!post || post.publishedAt === null) {
				reply.code(404);
				reply.send({ error: "Post not found" });
				return;
			}

			const collectionData = post.collection?.data[0];

			const collection: PostResponse["collection"] =
				post.collection && collectionData
					? {
							slug: post.collection.slug,
							title: collectionData.title,
							chapters: post.collection.posts
								.filter((chapter) => chapter.publishedAt !== null)
								.sort((a, b) => a.collectionOrder - b.collectionOrder)
								.map((chapter) => ({
									slug: chapter.slug,
									title: chapter.title,
								})),
						}
					: undefined;

			const response: PostResponse = {
				slug: post.slug,
				title: post.title,
				description: post.description,
				bannerUrl: post.bannerImage
					? createImageUrl(post.bannerImage)
					: undefined,
				socialImageUrl: post.socialImage
					? createImageUrl(post.socialImage)
					: undefined,
				wordCount: post.wordCount,
				publishedAt: post.publishedAt
					? post.publishedAt.toISOString()
					: undefined,
				authors: post.authors.map((author) => ({
					id: author.slug,
					name: author.name,
					profileImageUrl: author.profileImage
						? createImageUrl(author.profileImage)
						: undefined,
				})),
				collection,
			};

			reply.code(200);
			reply.send(response);
		},
	);
};

export default postRoutes;
