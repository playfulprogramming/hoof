import { db } from "@playfulprogramming/db";
import { env } from "@playfulprogramming/common";
import { createGitHubClient } from "./createGitHubClient.ts";

vi.mock("@playfulprogramming/github-api", () => {
	return {
		createInstallationClient: vi
			.fn((id) => ({ id }))
			.mockName("createInstallationClient"),
		publicClient: {},
	};
});

const findGithubInstallation = vi.mocked(
	db.query.githubInstallations.findFirst,
);
const environment = vi.spyOn(env, "ENVIRONMENT", "get");

test("given installationId is provided, the installation client is returned", async () => {
	const client = await createGitHubClient(1);
	expect(client).toStrictEqual({ id: 1 });
	expect(findGithubInstallation).not.toHaveBeenCalled();
});

test("given installation exists in db, the installation client is returned", async () => {
	findGithubInstallation.mockResolvedValue({
		id: "00000000-0000-0000-0000-000000000000",
		installationId: 2,
	});
	const client = await createGitHubClient();
	expect(client).toStrictEqual({ id: 2 });
});

test("given installation does not exist in db, an error is thrown", async () => {
	findGithubInstallation.mockResolvedValue(undefined);
	await expect(createGitHubClient()).rejects.toThrow(
		"No installation ID exists!",
	);
});

test("given ENVIRONMENT is development, the public client is returned", async () => {
	environment.mockReturnValue("development");
	const client = await createGitHubClient(4);
	expect(client).toStrictEqual({});
	expect(findGithubInstallation).not.toHaveBeenCalled();
});
