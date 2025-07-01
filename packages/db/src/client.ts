import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.ts";
import pg from "pg";
import { env } from "@playfulprogramming/common";

const native = pg.native!;
const pool = new native.Pool({
	connectionString: env.POSTGRES_URL,
	idleTimeoutMillis: 60_000,
	query_timeout: 30_000,
});

export const db = drizzle(pool, { schema });

export async function healthcheckPostgres() {
	// Test the connection
	try {
		await db.execute("select 1");
	} catch (e) {
		throw new Error("Unable to connect to database", { cause: e });
	}
}

await healthcheckPostgres();

pool.on("error", (err, _) => {
	console.error("Unexpected error on idle client:", err);
	process.exit(1);
});
