import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { spawnApp } from "../src/lib/spawn-app.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, "../src/generated");
const outputFile = path.join(outputDir, "api-schema.d.ts");

export default async function generateTypes() {
	await fs.mkdir(outputDir, { recursive: true });

	await using app = await spawnApp();
	const swaggerUrl = `${app.baseUrl}/openapi.json`;

	const response = await fetch(swaggerUrl);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`,
		);
	}
	const spec = await response.json();

	console.log("Generating types");
	const tempSpecFile = path.join(outputDir, ".api-spec.json");
	try {
		await fs.writeFile(tempSpecFile, JSON.stringify(spec, null, 0));
		execSync(
			`pnpm exec openapi-typescript "${tempSpecFile}" -o "${outputFile}"`,
			{
				stdio: "inherit",
			},
		);
	} finally {
		await fs.unlink(tempSpecFile);
	}

	console.log(`Types generated successfully at ${outputFile}`);
	console.log(
		`You may need to restart your TypeScript language server for changes to reflect`,
	);
}

if (process.argv[1] === __filename) {
	generateTypes()
		.then(() => process.exit(0))
		.catch(() => process.exit(1));
}
