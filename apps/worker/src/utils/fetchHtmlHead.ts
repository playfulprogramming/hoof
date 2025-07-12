import { Writable } from "stream";
import { fetchAsBotStream } from "./fetchAsBot.ts";

const MAX_BYTES_BEFORE_HEAD = 1000; // 1kb
const MAX_BYTES_TOTAL = 100000; // 100kb

export async function fetchHtmlHead(url: URL, signal?: AbortSignal) {
	const chunks: Buffer[] = [];
	let length = 0;
	let isHeadStart = false;
	let isHeadEnd = false;

	const writable = new Writable({
		write(chunk, _encoding, next) {
			if (!(chunk instanceof Buffer)) {
				console.error("fetchHtmlHead: chunk is not a Buffer!");
				return next();
			}

			if (!isHeadStart && length > MAX_BYTES_BEFORE_HEAD) return next();
			if (length > MAX_BYTES_TOTAL) return next();
			if (isHeadEnd) return next();

			length += chunk.length;
			chunks.push(chunk);

			const partialBuffer = chunks.length
				? Buffer.concat([chunks.at(-1)!, chunk])
				: chunk;

			if (!isHeadStart) {
				isHeadStart = partialBuffer.indexOf("<head>") != -1;
			}

			if (isHeadStart && !isHeadEnd) {
				isHeadEnd = partialBuffer.indexOf("</head>") != -1;
			}

			next();
		},
	});

	await fetchAsBotStream({
		url,
		method: "GET",
		headers: {
			"content-range": `bytes 0-${MAX_BYTES_TOTAL}/*`,
		},
		signal,
		writable,
	});

	const combinedBuffer = Buffer.concat(chunks);
	const startIndex = combinedBuffer.indexOf("<head>");
	const endIndex = combinedBuffer.indexOf("</head>");
	const slice = Uint8Array.prototype.slice.call(
		combinedBuffer,
		startIndex,
		endIndex + "</head>".length,
	);
	return new TextDecoder().decode(slice);
}
