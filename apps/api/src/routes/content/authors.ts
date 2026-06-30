import type { FastifyPluginAsync } from "fastify";
import { db } from "@playfulprogramming/db";
import { Type, type Static } from "typebox";
import { createImageUrl } from "../../utils.ts";

// ── Route ─────────────────────────────────────────────────────────────────────

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

			const profile = await db.query.profiles.findFirst({
				where: { slug },
				with: { achievements: true },
			});

			if (!profile) {
				reply.code(404);
				reply.send({ error: "Author not found" });
				return;
			}

			const meta = profile.meta as {
				socials?: Record<string, string>;
				roles?: string[];
			};

			const achievements = profile.achievements.map((a) => ({
				id: a.achievementId,
				grantedAt: a.grantedAt.toISOString(),
			}));

			const response: AuthorResponse = {
				id: profile.slug,
				name: profile.name,
				description: profile.description,
				profileImageUrl: profile.profileImage
					? createImageUrl(profile.profileImage)
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
