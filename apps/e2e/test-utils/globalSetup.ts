import { env } from "../src/util/env.ts";
import child_process from "child_process";

function exec(command: string): Promise<void> {
	return new Promise((res, rej) => {
		const child = child_process.exec(command, (error) =>
			error ? rej(error) : res(),
		);

		child.stdout?.on("data", console.log);
		child.stderr?.on("data", console.error);
	});
}

export async function setup() {
	if (!env.IN_DOCKER) {
		// If a test is started locally, ensure that the e2e containers are running
		console.log("Starting app in docker...");
		await exec("docker compose --profile e2e up app --wait");
	}
}
