import { join } from 'node:path';
import AutoLoad, {AutoloadPluginOptions} from '@fastify/autoload';
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify';
import Fastify from "fastify";
import queuePlugin from "./plugins/queue";
import urlMetadataPlugin from "./plugins/tasks/url-metadata";

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {

}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
}

const app: FastifyPluginAsync<AppOptions> = async (
    fastify,
    opts
): Promise<void> => {
  // Place here your custom code!

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts
  })
};

export async function createApp() {
  const app = Fastify({
    logger: true
  });

  // Remove these as they're now handled by AutoLoad
  // await app.register(queuePlugin);
  // await app.register(urlMetadataPlugin, { prefix: "/api" });

  return app;
}

export default app;
export { app, options }
