import fp from "fastify-plugin";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schemas from "./schemas/index.ts";

declare module "fastify" {
	interface FastifyInstance {
		db: NodePgDatabase<typeof schemas>;
	}
}

const pool = new Pool();
const db = drizzle(pool, { schema: { ...schemas } });

export default fp(
	async (fastify) => {
		// Test connection
		try {
			await pool.query("SELECT 1");
		} catch (error) {
			fastify.log.error(error);
			throw new Error("Failed to connect to the database");
		}

		fastify.decorate("db", db);

		// Cleanup on shutdown
		fastify.addHook("onClose", async () => {
			await pool.end();
		});
	},
	{
		name: "db",
		dependencies: ["env"],
	},
);
