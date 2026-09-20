import "./server.ts";
import { vi, beforeEach } from "vitest";
import "@playfulprogramming/test-fixtures";

beforeEach(() => {
	vi.clearAllMocks();
	vi.setSystemTime(new Date("2025-05-05"));
});
