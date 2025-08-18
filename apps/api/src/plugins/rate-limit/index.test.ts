import { shouldBypassRateLimit } from "./index.ts";
import { env } from "@playfulprogramming/common";

test("shouldBypassRateLimit returns true for valid token", () => {
	const mockRequest = {
		headers: {
			"x-hoof-auth-token": env.HOOF_AUTH_TOKEN,
		},
	};

	const result = shouldBypassRateLimit(mockRequest, env.HOOF_AUTH_TOKEN);
	expect(result).to.equal(true);
});

test("shouldBypassRateLimit returns false for invalid token", () => {
	const mockRequest = {
		headers: {
			"x-hoof-auth-token": "wrong-token",
		},
	};

	const result = shouldBypassRateLimit(mockRequest, env.HOOF_AUTH_TOKEN);
	expect(result).to.equal(false);
});

test("shouldBypassRateLimit returns false for missing token", () => {
	const mockRequest = {
		headers: {},
	};

	const result = shouldBypassRateLimit(mockRequest, env.HOOF_AUTH_TOKEN);
	expect(result).to.equal(false);
});

test("shouldBypassRateLimit returns false for empty token", () => {
	const mockRequest = {
		headers: {
			"x-hoof-auth-token": "",
		},
	};

	const result = shouldBypassRateLimit(mockRequest, env.HOOF_AUTH_TOKEN);
	expect(result).to.equal(false);
});

test("shouldBypassRateLimit returns false when envToken is missing", () => {
	const mockRequest = {
		headers: {
			"x-hoof-auth-token": "some-token",
		},
	};

	const result = shouldBypassRateLimit(mockRequest, undefined);
	expect(result).to.equal(false);
});

test("shouldBypassRateLimit handles array header values", () => {
	const mockRequest = {
		headers: {
			"x-hoof-auth-token": [env.HOOF_AUTH_TOKEN, "second-value"],
		},
	};

	const result = shouldBypassRateLimit(mockRequest, env.HOOF_AUTH_TOKEN);
	expect(result).to.equal(true);
});
