import { defineRelations } from "drizzle-orm";
import * as schema from "./schema/index.ts";

export const relations = defineRelations(schema, (r) => ({
	// Collections relations
	collections: {
		authors: r.many.authors({
			from: r.collections.slug.through(r.collectionAuthors.collectionSlug),
			to: r.authors.slug.through(r.collectionAuthors.authorSlug),
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
		author: r.one.authors({
			from: r.collectionAuthors.authorSlug,
			to: r.authors.slug,
		}),
	},

	// Posts relations
	posts: {
		authors: r.many.authors({
			from: r.posts.id.through(r.postAuthors.postId),
			to: r.authors.slug.through(r.postAuthors.authorSlug),
		}),
		collection: r.one.collections({
			from: r.posts.collectionSlug,
			to: r.collections.slug,
		}),
		tags: r.many.postTags({
			from: r.posts.id,
			to: r.postTags.postId,
		}),
		versions: r.many.posts({
			from: r.posts.groupId,
			to: r.posts.groupId,
		}),
	},

	// Posts authors junction
	postAuthors: {
		post: r.one.posts({
			from: r.postAuthors.postId,
			to: r.posts.id,
		}),
		author: r.one.authors({
			from: r.postAuthors.authorSlug,
			to: r.authors.slug,
		}),
	},

	// Authors relations
	authors: {
		postsAuthored: r.many.posts({
			from: r.authors.slug.through(r.postAuthors.authorSlug),
			to: r.posts.id.through(r.postAuthors.postId),
		}),
		collectionsAuthored: r.many.collections({
			from: r.authors.slug.through(r.collectionAuthors.authorSlug),
			to: r.collections.slug.through(r.collectionAuthors.collectionSlug),
		}),
		achievements: r.many.authorAchievements({
			from: r.authors.slug,
			to: r.authorAchievements.authorSlug,
		}),
	},

	// Author achievements relation
	authorAchievements: {
		author: r.one.authors({
			from: r.authorAchievements.authorSlug,
			to: r.authors.slug,
		}),
	},
}));
