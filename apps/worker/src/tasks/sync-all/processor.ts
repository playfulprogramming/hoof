import { BRANCH_MAIN, env } from "@playfulprogramming/common";
import {
	createFlowJobNode,
	flowProducer,
	Tasks,
} from "@playfulprogramming/bullmq";
import { createProcessor } from "../../createProcessor.ts";
import type { FlowJobNode } from "bullmq";
import { createGitHubClient } from "../../utils/createGitHubClient.ts";

export default createProcessor(Tasks.SYNC_ALL, async (job) => {
	const github = await createGitHubClient();
	const installation = {};

	const rootTree = await github.getTree({
		treeSha: job.data.ref,
		repoOwner: env.GITHUB_REPO_OWNER,
		repoName: env.GITHUB_REPO_NAME,
		signal: job.signal,
	});

	const contentSha = rootTree.tree.find((t) => t.path === "content")?.sha;
	if (!contentSha) throw new Error("No content dir found");

	const contentTree = await github.getTree({
		treeSha: contentSha,
		repoOwner: env.GITHUB_REPO_OWNER,
		repoName: env.GITHUB_REPO_NAME,
		signal: job.signal,
	});

	for (const author of contentTree.tree) {
		if (author.path === "data" || author.path === "site") continue;

		const authorTree = await github.getTree({
			treeSha: author.sha,
			repoOwner: env.GITHUB_REPO_OWNER,
			repoName: env.GITHUB_REPO_NAME,
			signal: job.signal,
		});

		const authorJobDef: FlowJobNode = createFlowJobNode({
			task: Tasks.SYNC_AUTHOR,
			name: author.path,
			data: {
				author: author.path,
				branch: BRANCH_MAIN,
				ref: job.data.ref,
				installation,
			},
		});

		const postsSha = authorTree.tree.find((t) => t.path === "posts")?.sha;
		const postsTree = postsSha
			? await github.getTree({
					treeSha: postsSha,
					repoOwner: env.GITHUB_REPO_OWNER,
					repoName: env.GITHUB_REPO_NAME,
					signal: job.signal,
				})
			: undefined;

		for (const post of postsTree?.tree ?? []) {
			await flowProducer.add(
				createFlowJobNode({
					task: Tasks.SYNC_POST,
					name: post.path,
					data: {
						author: author.path,
						post: post.path,
						branch: BRANCH_MAIN,
						ref: job.data.ref,
						installation,
					},
					children: [authorJobDef],
				}),
			);
		}

		const collectionsSha = authorTree.tree.find(
			(t) => t.path === "collections",
		)?.sha;
		const collectionsTree = collectionsSha
			? await github.getTree({
					treeSha: collectionsSha,
					repoOwner: env.GITHUB_REPO_OWNER,
					repoName: env.GITHUB_REPO_NAME,
					signal: job.signal,
				})
			: undefined;

		for (const collection of collectionsTree?.tree ?? []) {
			const collectionTree = await github.getTree({
				treeSha: collection.sha,
				repoOwner: env.GITHUB_REPO_OWNER,
				repoName: env.GITHUB_REPO_NAME,
				signal: job.signal,
			});

			const collectionPostsSha = collectionTree.tree.find(
				(t) => t.path === "posts",
			)?.sha;
			const collectionPostsTree = collectionPostsSha
				? await github.getTree({
						treeSha: collectionPostsSha,
						repoOwner: env.GITHUB_REPO_OWNER,
						repoName: env.GITHUB_REPO_NAME,
						signal: job.signal,
					})
				: undefined;

			const collectionJobDef: FlowJobNode = createFlowJobNode({
				task: Tasks.SYNC_COLLECTION,
				name: collection.path,
				data: {
					author: author.path,
					collection: collection.path,
					branch: BRANCH_MAIN,
					ref: job.data.ref,
					installation,
				},
				children: [authorJobDef],
			});

			for (const post of collectionPostsTree?.tree ?? []) {
				await flowProducer.add(
					createFlowJobNode({
						task: Tasks.SYNC_POST,
						name: post.path,
						data: {
							author: author.path,
							collection: collection.path,
							post: post.path,
							branch: BRANCH_MAIN,
							ref: job.data.ref,
							installation,
						},
						children: [collectionJobDef],
					}),
				);
			}

			if (!collectionPostsTree?.tree?.length) {
				await flowProducer.add(collectionJobDef);
			}
		}

		if (!postsTree?.tree?.length && !collectionsTree?.tree?.length) {
			await flowProducer.add(authorJobDef);
		}
	}

	return {};
});
