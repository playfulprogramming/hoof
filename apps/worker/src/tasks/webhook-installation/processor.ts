import { Tasks } from "@playfulprogramming/bullmq";
import { createProcessor } from "../../createProcessor.ts";
import { db, githubInstallations } from "@playfulprogramming/db";

export default createProcessor(Tasks.WEBHOOK_INSTALLATION, async (job) => {
	const event = job.data;

	if (event.action === "created") {
		await db.transaction(async (ctx) => {
			await ctx.delete(githubInstallations);
			await ctx.insert(githubInstallations).values({
				installationId: event.installation.id,
			});
		});
	}

	return {};
});
