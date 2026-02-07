import { env } from "@playfulprogramming/common";
import { createApp } from "./createApp.ts";

createApp().listen({ port: env.PORT, host: "0.0.0.0" }, (err) => {
	if (err) throw err;
});
