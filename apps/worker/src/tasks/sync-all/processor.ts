import { env } from "@playfulprogramming/common";
import {
	flowProducer,
	Tasks,
	type TaskInputs,
} from "@playfulprogramming/bullmq";
import * as github from "@playfulprogramming/github-api";
import { createProcessor } from "../../createProcessor.ts";
import type { FlowChildJob } from "bullmq";

export default createProcessor(Tasks.SYNC_ALL, async (job, { signal }) => {
	const rootTree = await github.getTree({
		treeSha: job.data.ref,
		repoOwner: env.GITHUB_REPO_OWNER,
		repoName: env.GITHUB_REPO_NAME,
		signal,
	});

	const contentSha = rootTree.tree.find((t) => t.path === "content")?.sha;
	if (!contentSha) throw new Error("No content dir found");

	const contentTree = await github.getTree({
		treeSha: contentSha,
		repoOwner: env.GITHUB_REPO_OWNER,
		repoName: env.GITHUB_REPO_NAME,
		signal,
	});

	for (const author of contentTree.tree) {
		if (author.path === "data" || author.path === "site") continue;

		const authorTree = await github.getTree({
			treeSha: author.sha,
			repoOwner: env.GITHUB_REPO_OWNER,
			repoName: env.GITHUB_REPO_NAME,
			signal,
		});

		const authorJobDef: FlowChildJob = {
			name: author.path,
			data: {
				author: author.path,
				ref: job.data.ref,
			} satisfies TaskInputs[typeof Tasks.SYNC_AUTHOR],
			queueName: Tasks.SYNC_AUTHOR,
		};

		const postsSha = authorTree.tree.find((t) => t.path === "posts")?.sha;
		const postsTree = postsSha
			? await github.getTree({
					treeSha: postsSha,
					repoOwner: env.GITHUB_REPO_OWNER,
					repoName: env.GITHUB_REPO_NAME,
					signal,
				})
			: undefined;

		for (const post of postsTree?.tree ?? []) {
			await flowProducer.add({
				name: post.path,
				data: {
					author: author.path,
					post: post.path,
					ref: job.data.ref,
				} satisfies TaskInputs[typeof Tasks.SYNC_POST],
				queueName: Tasks.SYNC_POST,
				children: [authorJobDef],
			});
		}

		const collectionsSha = authorTree.tree.find(
			(t) => t.path === "collections",
		)?.sha;
		const collectionsTree = collectionsSha
			? await github.getTree({
					treeSha: collectionsSha,
					repoOwner: env.GITHUB_REPO_OWNER,
					repoName: env.GITHUB_REPO_NAME,
					signal,
				})
			: undefined;

		for (const collection of collectionsTree?.tree ?? []) {
			const collectionTree = await github.getTree({
				treeSha: collection.sha,
				repoOwner: env.GITHUB_REPO_OWNER,
				repoName: env.GITHUB_REPO_NAME,
				signal,
			});

			const collectionPostsSha = collectionTree.tree.find(
				(t) => t.path === "posts",
			)?.sha;
			const collectionPostsTree = collectionPostsSha
				? await github.getTree({
						treeSha: collectionPostsSha,
						repoOwner: env.GITHUB_REPO_OWNER,
						repoName: env.GITHUB_REPO_NAME,
						signal,
					})
				: undefined;

			const collectionJobDef: FlowChildJob = {
				name: collection.path,
				data: {
					author: author.path,
					collection: collection.path,
					ref: job.data.ref,
				} satisfies TaskInputs[typeof Tasks.SYNC_COLLECTION],
				queueName: Tasks.SYNC_COLLECTION,
				children: [authorJobDef],
			};

			for (const post of collectionPostsTree?.tree ?? []) {
				await flowProducer.add({
					name: post.path,
					data: {
						author: author.path,
						collection: collection.path,
						post: post.path,
						ref: job.data.ref,
					} satisfies TaskInputs[typeof Tasks.SYNC_POST],
					queueName: Tasks.SYNC_POST,
					children: [collectionJobDef],
				});
			}
		}
	}

	return {};
});
