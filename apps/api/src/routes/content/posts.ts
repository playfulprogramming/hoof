import type { FastifyPluginAsync } from "fastify";
import {
	db,
	posts,
	postData,
	postTags,
	postAuthors,
	profiles,
} from "@playfulprogramming/db";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
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

type PostAuthorEntry = PostsResponse[number]["authors"][number];

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

			const conditions = [
				isNotNull(postData.publishedAt),
				eq(postData.noindex, false),
			];
			if (author) {
				conditions.push(
					sql`exists (select 1 from ${postAuthors} where ${postAuthors.postSlug} = ${posts.slug} and ${postAuthors.authorSlug} = ${author})`,
				);
			}

			const rows = await db
				.select({
					slug: posts.slug,
					title: postData.title,
					bannerImage: postData.bannerImage,
					wordCount: postData.wordCount,
					publishedAt: postData.publishedAt,
					tags: sql<
						string[]
					>`coalesce(array_agg(distinct ${postTags.tag}) filter (where ${postTags.tag} is not null), '{}')`,
				})
				.from(posts)
				.innerJoin(
					postData,
					and(
						eq(postData.slug, posts.slug),
						eq(postData.locale, locale),
						// No documented "current version" convention exists anywhere else in
						// the query layer (post.ts doesn't filter by version either); this
						// pins to the schema's default empty-string version to avoid
						// returning duplicate rows per slug/locale until one is established.
						eq(postData.version, ""),
					),
				)
				.leftJoin(postTags, eq(postTags.postSlug, posts.slug))
				.where(and(...conditions))
				.groupBy(
					posts.slug,
					postData.title,
					postData.bannerImage,
					postData.wordCount,
					postData.publishedAt,
				)
				.orderBy(
					sort === "oldest"
						? asc(postData.publishedAt)
						: desc(postData.publishedAt),
				)
				.limit(limit)
				.offset(page * limit);

			const slugs = rows.map((row) => row.slug);

			const authorRows = slugs.length
				? await db
						.select({
							postSlug: postAuthors.postSlug,
							id: profiles.slug,
							name: profiles.name,
							profileImage: profiles.profileImage,
						})
						.from(postAuthors)
						.innerJoin(profiles, eq(profiles.slug, postAuthors.authorSlug))
						.where(inArray(postAuthors.postSlug, slugs))
				: [];

			const authorsByPostSlug = new Map<string, PostAuthorEntry[]>();
			for (const authorRow of authorRows) {
				const entries = authorsByPostSlug.get(authorRow.postSlug) ?? [];
				entries.push({
					id: authorRow.id,
					name: authorRow.name,
					profileImageUrl: authorRow.profileImage
						? createImageUrl(authorRow.profileImage)
						: undefined,
				});
				authorsByPostSlug.set(authorRow.postSlug, entries);
			}

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
				authors: authorsByPostSlug.get(row.slug) ?? [],
				tags: row.tags,
			}));

			reply.code(200);
			reply.send(postsResponse);
		},
	);
};

export default postsRoutes;
