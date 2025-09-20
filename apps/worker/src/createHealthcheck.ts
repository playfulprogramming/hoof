import { env } from "@playfulprogramming/common";
import http from "http";
import { healthcheckRedis } from "@playfulprogramming/redis";
import { healthcheckPostgres } from "@playfulprogramming/db";

export function createHealthcheck() {
	const server = http.createServer(async (_, res) => {
		try {
			await Promise.all([healthcheckRedis(), healthcheckPostgres()]);
			console.log("Healthcheck success!");
			res.writeHead(200);
			res.end("OK");
		} catch (e) {
			console.error("Error during healthcheck:", e);
			res.writeHead(500);
			res.end();
		}
	});

	server.listen(env.WORKER_PORT);
	console.log("Listening for healthcheck on port", env.WORKER_PORT);
}
