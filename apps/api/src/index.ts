import { env } from "@playfulprogramming/common";
import rateLimit from "./plugins/rate-limit/index.ts";
import sensible from "./plugins/sensible.ts";
import swagger from "./plugins/swagger.ts";
import { healthRoutes } from "./routes/health.ts";
import postImagesRoutes from "./routes/tasks/post-images.ts";
import urlMetadataRoutes from "./routes/tasks/url-metadata.ts";
import fastify from "fastify";

export const createApp = () => {
	const app = fastify({
		logger: true,
	});

	app.register(rateLimit);
	app.register(sensible);
	app.register(swagger);
	app.register(healthRoutes);
	app.register(postImagesRoutes);
	app.register(urlMetadataRoutes);

	return app;
};

createApp().listen({ port: env.PORT, host: "0.0.0.0" }, (err) => {
	if (err) throw err;
});
