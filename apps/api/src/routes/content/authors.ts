import type { FastifyPluginAsync } from "fastify";
import { db, authors, postAuthors, posts } from "@playfulprogramming/db";
import { and, asc, countDistinct, desc, eq, isNotNull } from "drizzle-orm";
import { Type, type Static } from "typebox";
import { createImageUrl } from "../../utils.ts";

// ── List route ───────────────────────────────────────────────────────────────

const AuthorsQueryParamsSchema = Type.Object({
	page: Type.Number({ minimum: 0 }),
	limit: Type.Number({ minimum: 1 }),
	sortBy: Type.Union([Type.Literal("id"), Type.Literal("posts")], {
		default: "id",
	}),
});

const AuthorsResponseSchema = Type.Array(
	Type.Object(
		{
			id: Type.String(),
			name: Type.String(),
			description: Type.String(),
			profileImageUrl: Type.Optional(Type.String()),
			posts: Type.Number(),
		},
		{
			examples: [
				{
					id: "crutchcorn",
					name: "Corbin Crutchley",
					description: "Project lead for Playful Programming.",
					profileImageUrl: "https://example.test/profile.jpg",
					posts: 12,
				},
				{
					id: "fennifith",
					name: "James Fenn",
					description: "Backend lead for Playful Programming.",
					profileImageUrl: "https://example.test/profile.jpg",
					posts: 8,
				},
			],
		},
	),
);

type AuthorsResponse = Static<typeof AuthorsResponseSchema>;

// ── Single route ─────────────────────────────────────────────────────────────

const AuthorParamsSchema = Type.Object({
	slug: Type.String(),
});

const AchievementSchema = Type.Object({
	id: Type.String(),
	grantedAt: Type.String({ format: "date-time" }),
});

const AuthorResponseSchema = Type.Object({
	id: Type.String(),
	name: Type.String(),
	description: Type.String(),
	profileImageUrl: Type.Optional(Type.String()),
	socials: Type.Record(Type.String(), Type.String()),
	roles: Type.Array(Type.String()),
	achievements: Type.Array(AchievementSchema),
});

type AuthorResponse = Static<typeof AuthorResponseSchema>;

const AuthorErrorResponseSchema = Type.Object({
	error: Type.String(),
});

const authorsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get<{
		Querystring: Static<typeof AuthorsQueryParamsSchema>;
		Reply: AuthorsResponse;
	}>(
		"/content/authors",
		{
			schema: {
				description: "Fetch a list of authors",
				querystring: AuthorsQueryParamsSchema,
				response: {
					200: {
						description: "Successful",
						content: {
							"application/json": {
								schema: AuthorsResponseSchema,
							},
						},
					},
				},
			},
		},
		async (request, reply) => {
			const queryParams = request.query;
			const { sortBy } = queryParams;

			const authorRows = await db
				.select({
					slug: authors.slug,
					name: authors.name,
					description: authors.description,
					profileImage: authors.profileImage,
					postsCount: countDistinct(posts.slug),
				})
				.from(authors)
				.leftJoin(postAuthors, eq(postAuthors.authorSlug, authors.slug))
				.leftJoin(
					posts,
					and(
						eq(posts.id, postAuthors.postId),
						isNotNull(posts.publishedAt),
						eq(posts.noindex, false),
					),
				)
				.groupBy(
					authors.slug,
					authors.name,
					authors.description,
					authors.profileImage,
				)
				.orderBy(
					...(sortBy === "posts"
						? [desc(countDistinct(posts.slug)), asc(authors.slug)]
						: [asc(authors.slug)]),
				)
				.limit(queryParams.limit)
				.offset(queryParams.page * queryParams.limit);

			const authorsResponse: AuthorsResponse = authorRows.map((author) => ({
				id: author.slug,
				name: author.name,
				description: author.description,
				profileImageUrl: author.profileImage
					? createImageUrl(author.profileImage)
					: undefined,
				posts: author.postsCount,
			}));

			reply.code(200);
			reply.send(authorsResponse);
		},
	);

	fastify.get<{
		Params: Static<typeof AuthorParamsSchema>;
		Reply: AuthorResponse | { error: string };
	}>(
		"/content/authors/:slug",
		{
			schema: {
				description: "Fetch an author profile with their earned achievements",
				params: AuthorParamsSchema,
				response: {
					200: {
						description: "Successful",
						content: {
							"application/json": { schema: AuthorResponseSchema },
						},
					},
					404: {
						description: "Author not found",
						content: {
							"application/json": { schema: AuthorErrorResponseSchema },
						},
					},
				},
			},
		},
		async (request, reply) => {
			const { slug } = request.params;

			const author = await db.query.authors.findFirst({
				where: { slug },
				with: { achievements: true },
			});

			if (!author) {
				reply.code(404);
				reply.send({ error: "Author not found" });
				return;
			}

			const meta = author.meta as {
				socials?: Record<string, string>;
				roles?: string[];
			};

			const achievements = author.achievements.map((a) => ({
				id: a.achievementId,
				grantedAt: a.grantedAt.toISOString(),
			}));

			const response: AuthorResponse = {
				id: author.slug,
				name: author.name,
				description: author.description,
				profileImageUrl: author.profileImage
					? createImageUrl(author.profileImage)
					: undefined,
				socials: meta.socials ?? {},
				roles: meta.roles ?? [],
				achievements,
			};

			reply.code(200);
			reply.send(response);
		},
	);
};

export default authorsRoutes;
