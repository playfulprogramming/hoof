import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import {
	PeriodicExportingMetricReader,
	ConsoleMetricExporter,
} from "@opentelemetry/sdk-metrics";
import { FastifyOtelInstrumentation } from "@fastify/otel";

export const fastifyOtelInstrumentation = new FastifyOtelInstrumentation({
	servername: "hoof",
});

const sdk = new NodeSDK({
	traceExporter: new ConsoleSpanExporter(),
	metricReader: new PeriodicExportingMetricReader({
		exporter: new ConsoleMetricExporter(),
	}),
	instrumentations: [getNodeAutoInstrumentations(), fastifyOtelInstrumentation],
});

sdk.start();
