import crypto from "crypto";
import { s3 } from "@playfulprogramming/s3";
import { type Mock } from "vitest";
import { mockEndpoint } from "../../../../test-utils/server.ts";
import { processImages } from "./processImage.ts";

function md5(value: string): string {
	return crypto.createHash("md5").update(value).digest("hex");
}

async function readStreamToString(readable: NodeJS.ReadableStream) {
	const chunks: Buffer[] = [];
	for await (const chunk of readable) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf-8");
}

const onePixelPngBase64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg==";

test("decodes an inline percent-encoded SVG data URL without a network request", async () => {
	// Matches the shape from issue #28: an SVG data URL whose payload has an
	// unescaped `#`. The WHATWG URL parser splits that off into url.hash, so
	// url.pathname alone silently loses everything after it - the fix has to
	// parse from url.href instead.
	const dataUrl = new URL(
		"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Ccircle fill='#ff0000' cx='5' cy='5' r='5'/%3E%3C/svg%3E",
	);

	const result = await processImages(
		[dataUrl],
		24,
		"test-bucket",
		"remote-icon",
		"job-1",
		new AbortController().signal,
	);

	const expectedKey = `remote-icon-${md5(dataUrl.href)}.svg`;
	expect(result).toEqual({ key: expectedKey });

	expect(s3.upload).toBeCalledTimes(1);
	expect(s3.upload).toBeCalledWith(
		"test-bucket",
		expectedKey,
		"job-1",
		expect.anything(),
		"image/svg+xml",
	);

	const uploadedStream = (s3.upload as Mock).mock.calls[0][3];
	const uploadedSvg = await readStreamToString(uploadedStream);
	expect(uploadedSvg).toContain("<svg");
	// cx/cy/r sit after the unescaped `#` in the raw data URL - their
	// presence proves url.href (not the hash-truncated url.pathname) was
	// used to parse the payload
	expect(uploadedSvg).toContain('cx="5"');
	expect(uploadedSvg).toContain('cy="5"');
	expect(uploadedSvg).toContain('r="5"');
});

test("decodes an inline base64-encoded PNG data URL without a network request", async () => {
	const dataUrl = new URL(`data:image/png;base64,${onePixelPngBase64}`);

	const result = await processImages(
		[dataUrl],
		896,
		"test-bucket",
		"remote-banner",
		"job-2",
		new AbortController().signal,
	);

	const expectedKey = `remote-banner-${md5(dataUrl.href)}.png`;
	expect(result).toEqual({
		key: expectedKey,
		width: 1,
		height: 1,
	});

	expect(s3.upload).toBeCalledWith(
		"test-bucket",
		expectedKey,
		"job-2",
		expect.anything(),
		"image/png",
	);
});

test("still fetches and processes an http(s) image over the network", async () => {
	const url = new URL("https://example.test/banner.png");
	mockEndpoint({
		path: url,
		body: Uint8Array.from(Buffer.from(onePixelPngBase64, "base64")).buffer,
	});

	const result = await processImages(
		[url],
		896,
		"test-bucket",
		"remote-banner",
		"job-3",
		new AbortController().signal,
	);

	const expectedKey = `remote-banner-${md5(url.href)}.png`;
	expect(result).toEqual({
		key: expectedKey,
		width: 1,
		height: 1,
	});

	expect(s3.upload).toBeCalledWith(
		"test-bucket",
		expectedKey,
		"job-3",
		expect.anything(),
		"image/png",
	);
});
