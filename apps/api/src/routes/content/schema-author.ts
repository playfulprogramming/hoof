import { AuthorMetaSchema } from "../../../../worker/src/tasks/sync-author/types.ts";
import { createSchemaRoute } from "./createSchemaRoute.ts";

const schemaAuthorRoutes = createSchemaRoute(
	"/content/schema/author",
	"Fetch the JSON Schema for author frontmatter, as validated by the sync worker.",
	AuthorMetaSchema,
);

export default schemaAuthorRoutes;
