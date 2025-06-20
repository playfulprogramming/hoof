import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../src/client.ts";

const migrationsFolder = import.meta
	.resolve("../drizzle")
	.replace(/^file:\/\//, "");
console.log(`Running migrations from ${migrationsFolder}`);

await migrate(db, {
	migrationsFolder,
});
