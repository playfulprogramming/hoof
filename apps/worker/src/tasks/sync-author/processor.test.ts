import processor from "./processor.ts";
import type { TaskInputs } from "@playfulprogramming/bullmq";
import type { Job } from "bullmq";
import { db, profiles, authorRoles } from "@playfulprogramming/db";
import { s3 } from "@playfulprogramming/s3";
import * as github from "@playfulprogramming/github-api";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { uploadProcessedImage } from "../../utils/uploadProcessedImage.ts";

test("Creates an example profile successfully", async () => {
	const insertProfilesValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertAuthorRolesValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === profiles) {
			return { values: insertProfilesValues } as never;
		}
		if (table === authorRoles) {
			return { values: insertAuthorRolesValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === "/content/example/index.md") {
			return Promise.resolve({
				data: `---
{
  name: "Example Person",
  description: "Hello",
  profileImg: "./profile.png",
  roles: ["author", "editor"]
}
---
`,
				status: 200,
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
				status: 200,
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

	// The profile was inserted into the database, without roles in meta
	expect(insertProfilesValues).toBeCalledWith({
		slug: "example",
		name: "Example Person",
		description: "Hello",
		profileImage: "profiles/example.jpeg",
		meta: {
			socials: {},
		},
	});

	// Old roles were deleted, new roles were inserted
	expect(deleteWhere).toBeCalledWith(eq(authorRoles.profileSlug, "example"));
	expect(insertAuthorRolesValues).toBeCalledWith([
		{ profileSlug: "example", role: "author" },
		{ profileSlug: "example", role: "editor" },
	]);
});

test("Replaces an existing author's roles on a subsequent sync with a different role set", async () => {
	const insertProfilesValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertAuthorRolesValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === profiles) {
			return { values: insertProfilesValues } as never;
		}
		if (table === authorRoles) {
			return { values: insertAuthorRolesValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(github.getContentsRaw).mockImplementationOnce((params) => {
		if (params.path === "/content/example/index.md") {
			return Promise.resolve({
				data: `---
{
  name: "Example Person",
  description: "Hello",
  roles: ["author"]
}
---
`,
				status: 200,
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

	expect(insertAuthorRolesValues).toBeCalledWith([
		{ profileSlug: "example", role: "author" },
	]);

	vi.mocked(github.getContentsRaw).mockImplementationOnce((params) => {
		if (params.path === "/content/example/index.md") {
			return Promise.resolve({
				data: `---
{
  name: "Example Person",
  description: "Hello",
  roles: ["editor", "reviewer"]
}
---
`,
				status: 200,
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

	// Old roles were deleted again, and only the new role set was inserted
	expect(deleteWhere).toBeCalledWith(eq(authorRoles.profileSlug, "example"));
	expect(insertAuthorRolesValues).toHaveBeenLastCalledWith([
		{ profileSlug: "example", role: "editor" },
		{ profileSlug: "example", role: "reviewer" },
	]);
});

test("Inserts no rows for an author with an empty roles array", async () => {
	const insertProfilesValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: vi.fn(),
	});
	const insertAuthorRolesValues = vi.fn();

	vi.mocked(db.insert).mockImplementation((table) => {
		if (table === profiles) {
			return { values: insertProfilesValues } as never;
		}
		if (table === authorRoles) {
			return { values: insertAuthorRolesValues } as never;
		}
		throw new Error(`Unexpected table: ${table}`);
	});

	const deleteWhere = vi.fn();
	vi.mocked(db.delete).mockReturnValue({
		where: deleteWhere,
	} as never);

	vi.mocked(github.getContentsRaw).mockImplementation((params) => {
		if (params.path === "/content/example/index.md") {
			return Promise.resolve({
				data: `---
{
  name: "Example Person",
  description: "Hello"
}
---
`,
				status: 200,
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

	// Roles were still deleted (in case any existed previously), but nothing was inserted
	expect(deleteWhere).toBeCalledWith(eq(authorRoles.profileSlug, "example"));
	expect(insertAuthorRolesValues).not.toBeCalled();
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
				status: 404,
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

test("Rejects the profile image upload when the signal is already aborted", async () => {
	const controller = new AbortController();
	controller.abort();

	const buffer = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg==",
		"base64",
	);
	const stream = Readable.toWeb(
		Readable.from(buffer),
	) as ReadableStream<Uint8Array>;

	await expect(
		uploadProcessedImage(
			stream,
			"profiles/example.jpeg",
			2048,
			controller.signal,
		),
	).rejects.toThrow();
});

test("Aborts the in-flight pipeline when the s3 upload rejects first", async () => {
	vi.mocked(s3.upload).mockImplementation(async () => {
		throw new Error("Upload failed");
	});

	const buffer = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg==",
		"base64",
	);
	const nodeSource = Readable.from(buffer);
	const stream = Readable.toWeb(nodeSource) as ReadableStream<Uint8Array>;

	await expect(
		uploadProcessedImage(
			stream,
			"profiles/example.jpeg",
			2048,
			new AbortController().signal,
		),
	).rejects.toThrow("Upload failed");

	// The upload rejecting should also unwind the pipeline reading from it,
	// rather than leaving it hanging with nothing left to consume the stream
	await vi.waitFor(() => expect(nodeSource.destroyed).toBe(true));
});
