import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.ts";
import pg from "pg";

const native = pg.native!;
const pool = new native.Pool({
	connectionString: process.env.POSTGRES_URL,
});

export const db = drizzle(pool, { schema });

// Test the connection
try {
	await db.execute("select 1");
} catch (e) {
	throw new Error("Unable to connect to database", { cause: e });
}
