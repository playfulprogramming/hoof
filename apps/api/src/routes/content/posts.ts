import type { FastifyPluginAsync } from "fastify";
import { db, postAuthors } from "@playfulprogramming/db";
import { sql } from "drizzle-orm";
import { Type, type Static } from "typebox";
import { createImageUrl } from "../../utils.ts";
import { PostBaseSchema } from "./postBaseSchema.ts";

const PostsQueryParamsSchema = Type.Object({
	locale: Type.String({ default: "en" }),
	page: Type.Number({ minimum: 0, default: 0 }),
	limit: Type.Number({ minimum: 1, maximum: 100, default: 20 }),
	sort: Type.Union([Type.Literal("newest"), Type.Literal("oldest")], {
		default: "newest",
	}),
	author: Type.Optional(Type.String()),
});

const PostsResponseSchema = Type.Array(
	Type.Intersect(
		[PostBaseSchema, Type.Object({ tags: Type.Array(Type.String()) })],
		{
			examples: [
				{
					slug: "example-post",
					title: "Example Post",
					bannerUrl: "https://example.test/banner.png",
					wordCount: 1200,
					publishedAt: "2024-01-15T00:00:00.000Z",
					authors: [
						{
							id: "crutchcorn",
							name: "Corbin Crutchley",
							profileImageUrl: "https://example.test/profile.jpg",
						},
					],
					tags: ["react", "javascript"],
				},
			],
		},
	),
);

type PostsResponse = Static<typeof PostsResponseSchema>;

const postsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get<{
		Querystring: Static<typeof PostsQueryParamsSchema>;
		Reply: PostsResponse;
	}>(
		"/content/posts",
		{
			schema: {
				description: "Fetch a paginated list of posts for post-card display",
				querystring: PostsQueryParamsSchema,
				response: {
					200: {
						description: "Successful",
						content: {
							"application/json": { schema: PostsResponseSchema },
						},
					},
				},
			},
		},
		async (request, reply) => {
			const { locale, page, limit, sort, author } = request.query;

			const rows = await db.query.posts.findMany({
				columns: {
					slug: true,
					title: true,
					bannerImage: true,
					wordCount: true,
					publishedAt: true,
				},
				where: {
					locale,
					branch: "main",
					publishedAt: {
						isNotNull: true,
					},
					noindex: false,
					RAW: author
						? (posts) =>
								sql`exists (select 1 from ${postAuthors} where ${postAuthors.postId} = ${posts.id} and ${postAuthors.authorSlug} = ${author})`
						: undefined,
				},
				with: {
					authors: {
						columns: {
							slug: true,
							name: true,
							profileImage: true,
						},
					},
					tags: {
						columns: {
							tag: true,
						},
					},
				},
				orderBy: {
					publishedAt: sort === "oldest" ? "asc" : "desc",
				},
				limit: limit,
				offset: page * limit,
			});

			const postsResponse: PostsResponse = rows.map((row) => ({
				slug: row.slug,
				title: row.title,
				bannerUrl: row.bannerImage
					? createImageUrl(row.bannerImage)
					: undefined,
				wordCount: row.wordCount,
				publishedAt: row.publishedAt
					? row.publishedAt.toISOString()
					: undefined,
				authors: row.authors.map((authorRow) => ({
					id: authorRow.slug,
					name: authorRow.name,
					profileImageUrl: authorRow.profileImage
						? createImageUrl(authorRow.profileImage)
						: undefined,
				})),
				tags: row.tags.map(({ tag }) => tag),
			}));

			reply.code(200);
			reply.send(postsResponse);
		},
	);
};

export default postsRoutes;
