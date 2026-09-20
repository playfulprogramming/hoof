import { AuthorMetaSchema } from "@playfulprogramming/common";
import { createSchemaRoute } from "./createSchemaRoute.ts";

const schemaAuthorRoutes = createSchemaRoute(
	"/content/schema/author",
	"Fetch the JSON Schema for author frontmatter, as validated by the sync worker.",
	AuthorMetaSchema,
);

export default schemaAuthorRoutes;
