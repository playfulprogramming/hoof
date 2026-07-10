import { PostMetaSchema } from "@playfulprogramming/common";
import { createSchemaRoute } from "./createSchemaRoute.ts";

const schemaPostRoutes = createSchemaRoute(
	"/content/schema/post",
	"Fetch the JSON Schema for post frontmatter, as validated by the sync worker.",
	PostMetaSchema,
);

export default schemaPostRoutes;
