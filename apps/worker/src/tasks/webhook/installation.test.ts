import processor from "./installation.ts";
import { db, githubInstallations } from "@playfulprogramming/db";
import { fakeJob } from "../../../test-utils/fakeJob.ts";

test("Given an installation created event, the installation id is written to the database", async () => {
	// Run the processor
	await processor(
		fakeJob({
			action: "created",
			installation: {
				id: 1234,
			},
		}),
	);

	// Assert: The installation ID replaces the previous record
	expect(db.delete).toHaveBeenCalledWith(githubInstallations);
	expect(db.insert(githubInstallations).values).toHaveBeenCalledWith({
		installationId: 1234,
	});
});
