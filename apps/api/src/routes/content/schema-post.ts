import { PostMetaSchema } from "../../../../worker/src/tasks/sync-post/types.ts";
import { createSchemaRoute } from "./createSchemaRoute.ts";

const schemaPostRoutes = createSchemaRoute(
	"/content/schema/post",
	"Fetch the JSON Schema for post frontmatter, as validated by the sync worker.",
	PostMetaSchema,
);

export default schemaPostRoutes;
