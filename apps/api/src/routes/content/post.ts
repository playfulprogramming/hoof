import type { FastifyPluginAsync } from "fastify";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "typebox";
import { createImageUrl } from "../../utils.ts";

const PostParamsSchema = Type.Object({
	slug: Type.String(),
});

const PostQueryParamsSchema = Type.Object({
	locale: Type.String({ default: "en" }),
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
			const { locale } = request.query;

			const post = await db.query.posts.findFirst({
				where: { slug },
				with: {
					data: {
						columns: {
							title: true,
							description: true,
							bannerImage: true,
							socialImage: true,
							wordCount: true,
							publishedAt: true,
						},
						where: { locale },
					},
					authors: { columns: { slug: true, name: true, profileImage: true } },
					collection: {
						with: {
							data: {
								columns: { title: true },
								where: { locale },
							},
							posts: {
								columns: { slug: true, collectionOrder: true },
								with: {
									data: {
										columns: { title: true, publishedAt: true },
										where: { locale },
									},
								},
							},
						},
					},
				},
			});

			const postData = post?.data[0];

			if (!post || !postData || postData.publishedAt === null) {
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
								.filter(
									(chapter) =>
										chapter.data[0] && chapter.data[0].publishedAt !== null,
								)
								.sort((a, b) => a.collectionOrder - b.collectionOrder)
								.map((chapter) => ({
									slug: chapter.slug,
									title: chapter.data[0].title,
								})),
						}
					: undefined;

			const response: PostResponse = {
				slug: post.slug,
				title: postData.title,
				description: postData.description,
				bannerUrl: postData.bannerImage
					? createImageUrl(postData.bannerImage)
					: undefined,
				socialImageUrl: postData.socialImage
					? createImageUrl(postData.socialImage)
					: undefined,
				wordCount: postData.wordCount,
				publishedAt: postData.publishedAt
					? postData.publishedAt.toISOString()
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
