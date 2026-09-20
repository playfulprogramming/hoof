import { flowProducer, Tasks } from "@playfulprogramming/bullmq";
import { createProcessor } from "../../createProcessor.ts";
import { createInstallationClient } from "@playfulprogramming/github-api";
import { env } from "@playfulprogramming/common";
import { constructSyncJobs } from "./common.ts";

function isDefined<T>(value: T | undefined): value is T {
	return typeof value !== "undefined";
}

export default createProcessor(
	Tasks.WEBHOOK_PULL_REQUEST,
	async (job, { signal }) => {
		const client = await createInstallationClient(job.data.installation.id);

		const comparison = await client.getComparisonWithBasehead({
			owner: env.GITHUB_REPO_OWNER,
			repo: env.GITHUB_REPO_NAME,
			baseSha: job.data.commitBase,
			headSha: job.data.commitHead,
			signal,
		});

		const comparisonFiles = [
			...(comparison.files?.map((f) => f.filename) ?? []),
			...(comparison.files
				?.map((f) => f.previous_filename)
				?.filter(isDefined) ?? []),
		];

		const jobDef = constructSyncJobs({
			files: comparisonFiles,
			ref: job.data.commitHead,
			branch: job.data.branch,
			installation: job.data.installation,
		});
		if (jobDef) await flowProducer.add(jobDef);

		return {};
	},
);
