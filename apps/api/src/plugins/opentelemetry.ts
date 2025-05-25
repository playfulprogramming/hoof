import fp from "fastify-plugin";
import { fastifyOtelInstrumentation } from "@playfulprogramming/opentelemetry";

export default fp(
	(fastify) => {
		fastify.register(fastifyOtelInstrumentation.plugin());
	},
	{ name: "opentelemetry", dependencies: [] },
);
