import { defineRelations } from "drizzle-orm";
import * as schema from "./schema/index.ts";

export const relations = defineRelations(schema, (r) => ({
	// Collections relations
	collections: {
		authors: r.many.authors({
			from: r.collections.id.through(r.collectionAuthors.collectionId),
			to: r.authors.slug.through(r.collectionAuthors.authorSlug),
		}),
		posts: r.many.posts({
			from: r.collections.slug,
			to: r.posts.collectionSlug,
		}),
	},

	collectionSlugs: {
		data: r.many.collections({
			from: r.collectionSlugs.slug,
			to: r.collections.slug,
		}),
	},

	// Collection authors junction
	collectionAuthors: {
		collection: r.one.collections({
			from: r.collectionAuthors.collectionId,
			to: r.collections.id,
		}),
		author: r.many.authors({
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
		collections: r.many.collections({
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

	// Authors relations
	authors: {
		postsAuthored: r.many.posts({
			from: r.authors.slug.through(r.postAuthors.authorSlug),
			to: r.posts.id.through(r.postAuthors.postId),
		}),
		collectionsAuthored: r.many.collections({
			from: r.authors.slug.through(r.collectionAuthors.authorSlug),
			to: r.collections.id.through(r.collectionAuthors.collectionId),
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
