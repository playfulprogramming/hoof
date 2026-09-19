import { type TaskInputs, Tasks } from "@playfulprogramming/bullmq";
import type { FlowChildJob } from "bullmq";

interface ProcessWebhookParams {
	files: string[];
	ref: string;
	branch: string;
	installation: { id: number };
}

type CollectionEntry = { posts: Set<string> };

type AuthorEntry = {
	collections: Map<string, CollectionEntry>;
	posts: Set<string>;
};

const newCollectionEntry = (): CollectionEntry => ({ posts: new Set() });
const newAuthorEntry = (): AuthorEntry => ({
	collections: new Map(),
	posts: new Set(),
});

export function constructSyncJobs(
	params: ProcessWebhookParams,
): FlowChildJob | undefined {
	// Assemble a "task graph" with author -> collection? -> post dependencies from the changed files
	const authorEntries: Map<string, AuthorEntry> = new Map();

	for (const file of params.files) {
		{
			const [, author] = /^content\/([^/]+)\//.exec(file) ?? [];
			if (author) {
				authorEntries.getOrInsertComputed(author, newAuthorEntry);
			}
		}

		{
			const [, author, post] =
				/^content\/([^/]+)\/posts\/([^/]+)\//.exec(file) ?? [];
			if (author && post) {
				authorEntries
					.getOrInsertComputed(author, newAuthorEntry)
					.posts.add(post);
			}
		}

		{
			const [, author, collection] =
				/^content\/([^/]+)\/collections\/([^/]+)\//.exec(file) ?? [];
			if (author && collection) {
				authorEntries
					.getOrInsertComputed(author, newAuthorEntry)
					.collections.getOrInsertComputed(collection, newCollectionEntry);
			}
		}

		{
			const [, author, collection, post] =
				/^content\/([^/]+)\/collections\/([^/]+)\/posts\/([^/]+)\//.exec(
					file,
				) ?? [];
			if (author && collection && post) {
				authorEntries
					.getOrInsertComputed(author, newAuthorEntry)
					.collections.getOrInsertComputed(collection, newCollectionEntry)
					.posts.add(post);
			}
		}
	}

	// Construct a job definition to linearly process all entries
	let jobDef: FlowChildJob | undefined = undefined;

	for (const [
		author,
		{ collections, posts: authorPosts },
	] of authorEntries.entries()) {
		jobDef = {
			name: `${author}:${params.branch}:${params.ref}`,
			data: {
				author,
				ref: params.branch,
				installation: params.installation,
			} satisfies TaskInputs[typeof Tasks.SYNC_AUTHOR],
			queueName: Tasks.SYNC_AUTHOR,
			children: jobDef ? [jobDef] : undefined,
		};

		for (const [
			collection,
			{ posts: collectionPosts },
		] of collections.entries()) {
			jobDef = {
				name: `${author}/${collection}:${params.branch}:${params.ref}`,
				data: {
					author,
					collection,
					ref: params.branch,
					installation: params.installation,
				} satisfies TaskInputs[typeof Tasks.SYNC_COLLECTION],
				queueName: Tasks.SYNC_COLLECTION,
				children: [jobDef],
			};

			for (const post of collectionPosts) {
				jobDef = {
					name: `${author}/${collection}/${post}:${params.branch}:${params.ref}`,
					data: {
						author,
						collection,
						post,
						ref: params.branch,
						installation: params.installation,
					} satisfies TaskInputs[typeof Tasks.SYNC_POST],
					queueName: Tasks.SYNC_POST,
					children: [jobDef],
				};
			}
		}

		for (const post of authorPosts) {
			jobDef = {
				name: `${author}/${post}:${params.branch}:${params.ref}`,
				data: {
					author,
					post,
					ref: params.branch,
					installation: params.installation,
				} satisfies TaskInputs[typeof Tasks.SYNC_POST],
				queueName: Tasks.SYNC_POST,
				children: [jobDef],
			};
		}
	}

	return jobDef;
}
