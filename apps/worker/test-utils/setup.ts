import "./server.ts";
import { vi, afterEach } from "vitest";

afterEach(() => {
	vi.clearAllMocks();
	vi.setSystemTime(new Date("2025-05-05"));
});

vi.mock("@playfulprogramming/s3", () => {
	return {
		s3: {
			createBucket: vi.fn(() => "example-bucket"),
			upload: vi.fn(),
		},
	};
});

vi.mock("@playfulprogramming/db", () => {
	return {
		profiles: {
			slug: {},
		},
		db: {
			insert: vi.fn(),
		},
	};
});

vi.mock("@playfulprogramming/github-api", () => {
	return {
		getContents: vi.fn(),
		getContentsRaw: vi.fn(),
		getContentsRawStream: vi.fn(),
	};
});
