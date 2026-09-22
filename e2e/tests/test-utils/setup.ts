import { spawnApp } from "./spawnApp.ts";

const app = await spawnApp();

declare global {
	var client: typeof app.client;
}

globalThis.client = app.client;

afterAll(app.close);
