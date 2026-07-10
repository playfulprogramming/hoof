import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../src/client.ts";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
console.log(`Running migrations from ${migrationsFolder}`);

await migrate(db, {
	migrationsFolder,
});
