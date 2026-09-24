import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/client.ts";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
console.log(`Running migrations from ${migrationsFolder}`);

await migrate(db, {
	migrationsFolder,
});

console.log("Completed migrations.");
await pool.end();
console.log("Closed pool.");
