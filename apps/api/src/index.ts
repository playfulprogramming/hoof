import env from "./plugins/env.ts";
import opentelemetry from "./plugins/opentelemetry.ts";
import sensible from "./plugins/sensible.ts";
import swagger from "./plugins/swagger.ts";
import rootRoute from "./routes/root.ts";
import postImagesRoutes from "./routes/tasks/post-images.ts";
import urlMetadataRoutes from "./routes/tasks/url-metadata.ts";
import fastify from "fastify";

const app = fastify({
	logger: true,
});

app.register(env);
app.register(opentelemetry);
app.register(sensible);
app.register(swagger);
app.register(rootRoute);
app.register(postImagesRoutes);
app.register(urlMetadataRoutes);

app.listen({ port: 3000 }, (err) => {
	if (err) throw err;
});
