import fs from "fs/promises";
import path from "path";
import { spawnApp } from "../test-utils/spawnApp.ts";
import openapiTypescript, { astToString } from "openapi-typescript";

const outputDir = path.join(import.meta.dirname, "../src/generated");
const outputFile = path.join(outputDir, "api-schema.d.ts");

export default async function generateTypes() {
	await fs.mkdir(outputDir, { recursive: true });

	await using app = await spawnApp();
	const response = await fetch(`${app.baseUrl}/openapi.json`);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`,
		);
	}
	const spec = await response.json();

	console.log("Generating types");
	await fs.writeFile(
		outputFile,
		astToString(await openapiTypescript(spec, {})),
	);

	console.log(`Types generated successfully at ${outputFile}`);
	console.log(
		`You may need to restart your TypeScript language server for changes to reflect`,
	);
}

if (process.argv[1] === import.meta.filename) {
	generateTypes()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error("generateTypes failed:", err);
			process.exit(1);
		});
}
