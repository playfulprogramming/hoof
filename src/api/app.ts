import { join } from "node:path";
import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import { FastifyPluginAsync, FastifyServerOptions } from "fastify";

export interface AppOptions
	extends FastifyServerOptions,
		Partial<AutoloadPluginOptions> {}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {};

const api: FastifyPluginAsync<AppOptions> = async (
	fastify,
	opts,
): Promise<void> => {
	// Place here your custom code!

	// Do not touch the following lines
	// This loads all shared plugins
	void fastify.register(AutoLoad, {
		dir: "../shared_lib/plugins",
		options: opts,
	});

	// This loads all plugins defined in routes
	// (Remember, everything in Fastify is a plugin)
	void fastify.register(AutoLoad, {
		dir: join(__dirname, "routes"),
		options: opts,
	});
};

export default api;
export { api, options };
