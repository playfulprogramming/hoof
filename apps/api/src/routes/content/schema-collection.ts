import { CollectionMetaSchema } from "../../../../worker/src/tasks/sync-collection/types.ts";
import { createSchemaRoute } from "./createSchemaRoute.ts";

const schemaCollectionRoutes = createSchemaRoute(
	"/content/schema/collection",
	"Fetch the JSON Schema for collection frontmatter, as validated by the sync worker.",
	CollectionMetaSchema,
);

export default schemaCollectionRoutes;
