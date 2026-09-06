CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"installation_id" bigint NOT NULL
);
