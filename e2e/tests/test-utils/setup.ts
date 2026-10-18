import { spawnApp as spawnAppImpl } from "./spawnApp.ts";

declare global {
	var spawnApp: typeof spawnAppImpl;
}

globalThis.spawnApp = async () => {
	const app = await spawnAppImpl();
	afterAll(app[Symbol.asyncDispose]);
	return app;
};
