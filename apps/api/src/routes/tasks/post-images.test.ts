import fastify from "fastify";
import postImagesRoutes from "./post-images.ts";
import { db } from "@playfulprogramming/db";
import { queues } from "../../utils/queues.ts";

test("post-images creates a job when none is present", async () => {
	const app = fastify();
	app.register(postImagesRoutes);

	vi.mocked(db.query.postImages.findFirst).mockReturnValue(undefined as never);

	const response = await app.inject({
		method: "POST",
		url: "/tasks/post-images",
		body: {
			slug: "example",
			author: "fennifith",
			path: "content/fennifith/posts/example/index.md",
			indexMd5: "test-md5",
		},
	});

	expect(response.statusCode).to.equal(201);
	expect(queues["post-images"].add).toBeCalledWith(
		"example",
		{
			slug: "example",
			author: "fennifith",
			path: "content/fennifith/posts/example/index.md",
			indexMd5: "test-md5",
		},
		{
			deduplication: {
				id: "example",
			},
		},
	);
});

test("post-images returns existing data from the db", async () => {
	const app = fastify();
	app.register(postImagesRoutes);

	vi.mocked(db.query.postImages.findFirst).mockReturnValue({
		slug: "test-slug",
		bannerKey: "test-banner-key",
		linkPreviewKey: "test-link-preview-key",
		indexMd5: "test-md5",
		fetchedAt: new Date("2025-05-05"),
		error: false,
	} as never);

	const response = await app.inject({
		method: "POST",
		url: "/tasks/post-images",
		body: {
			slug: "example",
			author: "fennifith",
			path: "content/fennifith/posts/example/index.md",
			indexMd5: "test-md5",
		},
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).toMatchInlineSnapshot(`
		{
		  "banner": "https://s3_public_url.test/s3_bucket/test-banner-key",
		  "linkPreview": "https://s3_public_url.test/s3_bucket/test-link-preview-key",
		}
	`);
	expect(queues["post-images"].add).toBeCalledTimes(0);
});
