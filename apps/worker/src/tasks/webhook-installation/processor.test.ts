import processor from "./processor.ts";
import { type TaskInputs } from "@playfulprogramming/bullmq";
import type { Job } from "bullmq";
import { db, githubInstallations } from "@playfulprogramming/db";

test("Given an installation created event, the installation id is written to the database", async () => {
	// Run the processor
	await processor({
		data: {
			action: "created",
			installation: {
				id: 1234,
			},
		},
	} as unknown as Job<TaskInputs["webhook-installation"]>);

	// Assert: The installation ID replaces the previous record
	expect(db.delete).toHaveBeenCalledWith(githubInstallations);
	expect(db.insert(githubInstallations).values).toHaveBeenCalledWith({
		installationId: 1234,
	});
});
