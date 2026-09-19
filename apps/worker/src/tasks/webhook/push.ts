import { Tasks } from "@playfulprogramming/bullmq";
import { createProcessor } from "../../createProcessor.ts";
import { createInstallationClient } from "@playfulprogramming/github-api";
import { BRANCH_MAIN, env } from "@playfulprogramming/common";
import { enqueueSyncJobs } from "./common.ts";

export default createProcessor(Tasks.WEBHOOK_PUSH, async (job, { signal }) => {
	const client = await createInstallationClient(job.data.installation.id);

	const comparison = await client.getComparisonWithBasehead({
		owner: env.GITHUB_REPO_OWNER,
		repo: env.GITHUB_REPO_NAME,
		baseSha: job.data.commitBefore,
		headSha: job.data.commitAfter,
		signal,
	});

	const comparisonFiles = comparison.files?.map((f) => f.filename) ?? [];

	await enqueueSyncJobs({
		files: comparisonFiles,
		ref: job.data.commitAfter,
		branch: BRANCH_MAIN,
		installation: job.data.installation,
	});

	return {};
});
