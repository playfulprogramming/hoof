import processor from "./processor.ts";
import type { TaskInputs } from "@playfulprogramming/common";
import type { Job } from "bullmq";
import { db, profiles } from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import * as github from "@playfulprogramming/github-api";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";

test("Creates an example profile successfully", async () => {
	const insertValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	vi.mocked(db.insert).mockReturnValue({
		values: insertValues,
	} as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === "/content/example/index.md") {
			return Promise.resolve({
				data: `---
{
  name: "Example Person",
  description: "Hello",
  profileImg: "./profile.png"
}
---
`,
				response: {} as never,
			});
		}
		return Promise.reject();
	});

	vi.mocked(github.getContentsRawStream).mockImplementation((params) => {
		if (params.path === "/content/example/profile.png") {
			const buffer = Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg==",
				"base64",
			);
			return Promise.resolve({
				data: Readable.toWeb(Readable.from(buffer)) as never,
				response: {} as never,
			});
		}
		return Promise.reject();
	});

	await processor({
		data: {
			author: "example",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-author"]>);

	// The profile image was uploaded to S3
	expect(s3.upload).toBeCalledWith(
		"example-bucket",
		"profiles/example.jpeg",
		undefined,
		expect.anything(),
		"image/jpeg",
	);

	// The profile was inserted into the database
	expect(insertValues).toBeCalledWith({
		slug: "example",
		name: "Example Person",
		description: "Hello",
		profileImage: "profiles/example.jpeg",
		meta: {
			socials: {},
			roles: [],
		},
	});
});

test("Deletes a profile record if it no longer exists", async () => {
	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === "/content/example/index.md") {
			return Promise.resolve({
				data: undefined,
				error: {},
				response: {
					status: 404,
				} as never,
			});
		}
		return Promise.reject();
	});

	await processor({
		data: {
			author: "example",
			ref: "main",
		},
	} as unknown as Job<TaskInputs["sync-author"]>);

	// The profile was deleted from the database
	expect(deleteWhere).toBeCalledWith(eq(profiles.slug, "example"));
});
