import "./environment.ts";
import createClient from "openapi-fetch";
import type { paths } from "../src/generated/api-schema.d.ts";
import process from "process";
import child_process from "child_process";
import net from "net";
import { randomUUID } from "crypto";
import { db } from "@playfulprogramming/db";
import { once } from "events";
import path from "path";

function findOpenPort(): Promise<number> {
	return new Promise((res) => {
		const server = net.createServer();
		server.listen(0, () => {
			const { port } = server.address() as net.AddressInfo;
			server.close(() => res(port));
		});
	});
}

function killGroup(pid: number) {
	if (process.platform === "win32") {
		child_process.execSync(`taskkill /pid ${pid} /T /F`);
	} else {
		process.kill(-pid);
	}
}

type ExecOptions = {
	command: string;
	env?: Record<string, string>;
};
function exec({ command, env }: ExecOptions) {
	const child = child_process.spawn(command, {
		env: { ...process.env, ...env },
		shell: true,
		detached: true,
		stdio: "inherit",
	});

	return {
		kill() {
			if (child.pid) killGroup(child.pid);
		},
		exit: once(child, "close").then(() => {
			if (child.exitCode !== null && child.exitCode !== 0) {
				throw new Error(`'${command} exited with code ${child.exitCode}`);
			}
		}),
	};
}

export async function spawnApp() {
	const port = await findOpenPort();
	const uuid = randomUUID();

	console.log(`Spawning app ${uuid}...`);

	const database = `e2e-${uuid}`;
	await db.execute(`CREATE DATABASE "${database}"`);

	async function disposeApp() {
		try {
			await exec({
				command: "docker compose down",
				env,
			}).exit;
		} finally {
			await db.execute(`DROP DATABASE "${database}"`);
		}
	}

	const env = {
		COMPOSE_PROJECT_NAME: `hoof-e2e-${uuid}`,
		COMPOSE_FILE: path.resolve(
			import.meta.dirname,
			"../../../docker-compose.e2e.yml",
		),
		COMPOSE_PROGRESS: "quiet",
		E2E_PORT: String(port),
		E2E_POSTGRES_DATABASE: database,
		E2E_BULLMQ_PREFIX: database,
	};

	try {
		await exec({
			command: "docker compose up app --wait",
			env,
		}).exit;
	} catch (e) {
		console.error("Failed to start app:", e);
		await disposeApp();
		throw e;
	}

	const dockerLogs = exec({
		command: "docker compose logs --follow",
		env,
	});

	console.log("Ready!");

	const baseUrl = `http://localhost:${port}`;
	const client = createClient<paths>({
		baseUrl,
	});

	let isDisposed = false;

	return {
		baseUrl,
		client,
		async [Symbol.asyncDispose]() {
			if (isDisposed) return;
			console.log(`Closing app ${uuid}`);
			try {
				dockerLogs.kill();
				await dockerLogs.exit;
			} finally {
				await disposeApp();
			}
			isDisposed = true;
		},
	};
}
