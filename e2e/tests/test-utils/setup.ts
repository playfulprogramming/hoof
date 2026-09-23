import { spawnApp as spawnAppImpl } from "./spawnApp.ts";

declare global {
	var spawnApp: typeof spawnAppImpl;
}

globalThis.spawnApp = spawnAppImpl;
