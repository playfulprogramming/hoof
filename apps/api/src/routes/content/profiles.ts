import type { FastifyPluginAsync } from "fastify";
import { db, profiles, postAuthors, postData } from "@playfulprogramming/db";
import { and, asc, countDistinct, desc, eq, isNotNull } from "drizzle-orm";
import { Type, type Static } from "typebox";
import { createImageUrl } from "../../utils.ts";

const ProfilesQueryParamsSchema = Type.Object({
	page: Type.Number({ minimum: 0 }),
	limit: Type.Number({ minimum: 1 }),
	sortBy: Type.Union([Type.Literal("id"), Type.Literal("posts")], {
		default: "id",
	}),
});

const ProfilesResponseSchema = Type.Array(
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

type ProfilesResponse = Static<typeof ProfilesResponseSchema>;

const profilesRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get<{
		Querystring: Static<typeof ProfilesQueryParamsSchema>;
		Reply: ProfilesResponse;
	}>(
		"/content/profiles",
		{
			schema: {
				description: "Fetch a list of author profiles",
				querystring: ProfilesQueryParamsSchema,
				response: {
					200: {
						description: "Successful",
						content: {
							"application/json": {
								schema: ProfilesResponseSchema,
							},
						},
					},
				},
			},
		},
		async (request, reply) => {
			const queryParams = request.query;
			const { sortBy } = queryParams;

			const profileRows = await db
				.select({
					slug: profiles.slug,
					name: profiles.name,
					description: profiles.description,
					profileImage: profiles.profileImage,
					postsCount: countDistinct(postData.slug),
				})
				.from(profiles)
				.leftJoin(postAuthors, eq(postAuthors.authorSlug, profiles.slug))
				.leftJoin(
					postData,
					and(
						eq(postData.slug, postAuthors.postSlug),
						isNotNull(postData.publishedAt),
						eq(postData.noindex, false),
					),
				)
				.groupBy(
					profiles.slug,
					profiles.name,
					profiles.description,
					profiles.profileImage,
				)
				.orderBy(
					...(sortBy === "posts"
						? [desc(countDistinct(postData.slug)), asc(profiles.slug)]
						: [asc(profiles.slug)]),
				)
				.limit(queryParams.limit)
				.offset(queryParams.page * queryParams.limit);

			const profilesResponse: ProfilesResponse = profileRows.map((profile) => ({
				id: profile.slug,
				name: profile.name,
				description: profile.description,
				profileImageUrl: profile.profileImage
					? createImageUrl(profile.profileImage)
					: undefined,
				posts: profile.postsCount,
			}));

			reply.code(200);
			reply.send(profilesResponse);
		},
	);
};

export default profilesRoutes;
