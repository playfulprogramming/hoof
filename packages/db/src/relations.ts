import { defineRelations } from "drizzle-orm";
import * as schema from "./schema/index.ts";

export const relations = defineRelations(schema, (r) => ({
	// Collections relations
	collections: {
		authors: r.many.profiles({
			from: r.collections.slug.through(r.collectionAuthors.collectionSlug),
			to: r.profiles.slug.through(r.collectionAuthors.authorSlug),
		}),
		posts: r.many.posts(),
		data: r.many.collectionData({
			from: r.collections.slug,
			to: r.collectionData.slug,
		}),
	},

	// Collection authors junction
	collectionAuthors: {
		collection: r.one.collections({
			from: r.collectionAuthors.collectionSlug,
			to: r.collections.slug,
		}),
		author: r.one.profiles({
			from: r.collectionAuthors.authorSlug,
			to: r.profiles.slug,
		}),
	},

	// Posts relations
	posts: {
		authors: r.many.profiles({
			from: r.posts.id.through(r.postAuthors.postId),
			to: r.profiles.slug.through(r.postAuthors.authorSlug),
		}),
		collection: r.one.collections({
			from: r.posts.collectionSlug,
			to: r.collections.slug,
		}),
	},

	// Posts authors junction
	postAuthors: {
		post: r.one.posts({
			from: r.postAuthors.postId,
			to: r.posts.id,
		}),
		author: r.one.profiles({
			from: r.postAuthors.authorSlug,
			to: r.profiles.slug,
		}),
	},

	// Profiles relations
	profiles: {
		postsAuthored: r.many.posts({
			from: r.profiles.slug.through(r.postAuthors.authorSlug),
			to: r.posts.id.through(r.postAuthors.postId),
		}),
		collectionsAuthored: r.many.collections({
			from: r.profiles.slug.through(r.collectionAuthors.authorSlug),
			to: r.collections.slug.through(r.collectionAuthors.collectionSlug),
		}),
		achievements: r.many.profileAchievements({
			from: r.profiles.slug,
			to: r.profileAchievements.profileSlug,
		}),
	},

	// Profile achievements relation
	profileAchievements: {
		profile: r.one.profiles({
			from: r.profileAchievements.profileSlug,
			to: r.profiles.slug,
		}),
	},
}));
