import fastify from "fastify";
import urlMetadataRoutes from "./url-metadata.ts";
import { db } from "@playfulprogramming/db";
import { queues } from "../../utils/queues.ts";

test("url-metadata returns 400 when a URL is not valid", async () => {
	const app = fastify();
	app.register(urlMetadataRoutes);

	vi.mocked(db.query.postImages.findFirst).mockReturnValue(undefined as never);

	const response = await app.inject({
		method: "POST",
		url: "/tasks/url-metadata",
		body: {
			url: "invalid_url",
		},
	});

	expect(response.statusCode).to.equal(400);
});

test("url-metadata creates a job when none is present", async () => {
	const app = fastify();
	app.register(urlMetadataRoutes);

	vi.mocked(db.query.postImages.findFirst).mockReturnValue(undefined as never);

	const response = await app.inject({
		method: "POST",
		url: "/tasks/url-metadata",
		body: {
			url: "https://playfulprogramming.com",
		},
	});

	expect(response.statusCode).to.equal(201);
	expect(queues["url-metadata"].add).toBeCalledWith(
		"https://playfulprogramming.com/",
		{
			url: "https://playfulprogramming.com/",
		},
		{
			deduplication: {
				id: "https://playfulprogramming.com/",
			},
		},
	);
});

test("url-metadata returns existing data from the db", async () => {
	const app = fastify();
	app.register(urlMetadataRoutes);

	vi.mocked(db.query.urlMetadata.findFirst).mockReturnValue({
		url: "https://playfulprogramming.com",
		title: "Playful Programming",
		iconKey: "test-icon-key",
		iconWidth: 24,
		iconHeight: 24,
		bannerKey: "test-banner-key",
		bannerWidth: 1080,
		bannerHeight: 720,
		fetchedAt: new Date("2025-05-05"),
		error: false,
	} as never);

	const response = await app.inject({
		method: "POST",
		url: "/tasks/url-metadata",
		body: {
			url: "https://playfulprogramming.com",
		},
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).toMatchInlineSnapshot(`
		{
		  "banner": {
		    "height": 720,
		    "src": "https://s3_public_url.test/s3_bucket/test-banner-key",
		    "width": 1080,
		  },
		  "error": false,
		  "icon": {
		    "height": 24,
		    "src": "https://s3_public_url.test/s3_bucket/test-icon-key",
		    "width": 24,
		  },
		  "title": "Playful Programming",
		}
	`);
	expect(queues["url-metadata"].add).toBeCalledTimes(0);
});

test("url-metadata re-runs the task if the database recorded an error", async () => {
	const app = fastify();
	app.register(urlMetadataRoutes);

	vi.mocked(db.query.urlMetadata.findFirst).mockReturnValue({
		url: "https://playfulprogramming.com",
		title: "Playful Programming",
		iconKey: "test-icon-key",
		iconWidth: 24,
		iconHeight: 24,
		fetchedAt: new Date("2025-05-05"),
		error: true,
	} as never);

	const response = await app.inject({
		method: "POST",
		url: "/tasks/url-metadata",
		body: {
			url: "https://playfulprogramming.com",
		},
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).toMatchInlineSnapshot(`
		{
		  "error": true,
		  "icon": {
		    "height": 24,
		    "src": "https://s3_public_url.test/s3_bucket/test-icon-key",
		    "width": 24,
		  },
		  "title": "Playful Programming",
		}
	`);
	expect(queues["url-metadata"].add).toBeCalledTimes(1);
});

test("url-metadata re-runs the task if the fetchedAt date was 30+ days ago", async () => {
	const app = fastify();
	app.register(urlMetadataRoutes);

	vi.mocked(db.query.urlMetadata.findFirst).mockReturnValue({
		url: "https://playfulprogramming.com",
		title: "Playful Programming",
		iconKey: "test-icon-key",
		iconWidth: 24,
		iconHeight: 24,
		bannerKey: "test-banner-key",
		bannerWidth: 1080,
		bannerHeight: 720,
		fetchedAt: new Date("2025-04-04"),
		error: false,
	} as never);

	const response = await app.inject({
		method: "POST",
		url: "/tasks/url-metadata",
		body: {
			url: "https://playfulprogramming.com",
		},
	});

	expect(response.statusCode).to.equal(200);
	expect(response.json()).toMatchInlineSnapshot(`
		{
		  "banner": {
		    "height": 720,
		    "src": "https://s3_public_url.test/s3_bucket/test-banner-key",
		    "width": 1080,
		  },
		  "error": false,
		  "icon": {
		    "height": 24,
		    "src": "https://s3_public_url.test/s3_bucket/test-icon-key",
		    "width": 24,
		  },
		  "title": "Playful Programming",
		}
	`);
	expect(queues["url-metadata"].add).toBeCalledTimes(1);
});
