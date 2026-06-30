import type { FastifyPluginAsync } from "fastify";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "typebox";
import { createImageUrl } from "../../utils.ts";

const ProfilesQueryParamsSchema = Type.Object({
	page: Type.Number({ minimum: 0 }),
	limit: Type.Number({ minimum: 1 }),
});

const ProfilesResponseSchema = Type.Array(
	Type.Object(
		{
			id: Type.String(),
			name: Type.String(),
			description: Type.String(),
			profileImageUrl: Type.Optional(Type.String()),
		},
		{
			examples: [
				{
					id: "crutchcorn",
					name: "Corbin Crutchley",
					description: "Project lead for Playful Programming.",
					profileImageUrl: "https://example.test/profile.jpg",
				},
				{
					id: "fennifith",
					name: "James Fenn",
					description: "Backend lead for Playful Programming.",
					profileImageUrl: "https://example.test/profile.jpg",
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

			const profiles = await db.query.profiles.findMany({
				columns: {
					slug: true,
					name: true,
					description: true,
					profileImage: true,
				},
				offset: queryParams.page * queryParams.limit,
				limit: queryParams.limit,
			});

			const profilesResponse: ProfilesResponse = profiles.map((profile) => ({
				id: profile.slug,
				name: profile.name,
				description: profile.description,
				profileImageUrl: profile.profileImage
					? createImageUrl(profile.profileImage)
					: undefined,
			}));

			reply.code(200);
			reply.send(profilesResponse);
		},
	);
};

export default profilesRoutes;
