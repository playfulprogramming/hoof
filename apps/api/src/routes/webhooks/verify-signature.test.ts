import crypto from "crypto";
import { verifyGithubSignature } from "./verify-signature.ts";

function sign(payload: string, secret: string): string {
	return (
		"sha256=" +
		crypto.createHmac("sha256", secret).update(payload).digest("hex")
	);
}

test("verifyGithubSignature returns true for a valid signature", () => {
	const payload = JSON.stringify({ ref: "refs/heads/main" });
	const secret = "test-secret";

	const result = verifyGithubSignature(payload, sign(payload, secret), secret);
	expect(result).to.equal(true);
});

test("verifyGithubSignature returns false for a mismatched secret", () => {
	const payload = JSON.stringify({ ref: "refs/heads/main" });

	const result = verifyGithubSignature(
		payload,
		sign(payload, "wrong-secret"),
		"test-secret",
	);
	expect(result).to.equal(false);
});

test("verifyGithubSignature returns false when the body has been tampered with", () => {
	const secret = "test-secret";
	const signature = sign(JSON.stringify({ ref: "refs/heads/main" }), secret);

	const result = verifyGithubSignature(
		JSON.stringify({ ref: "refs/heads/malicious" }),
		signature,
		secret,
	);
	expect(result).to.equal(false);
});

test("verifyGithubSignature returns false for a missing signature", () => {
	const result = verifyGithubSignature(
		JSON.stringify({ ref: "refs/heads/main" }),
		undefined,
		"test-secret",
	);
	expect(result).to.equal(false);
});

test("verifyGithubSignature returns false for an empty signature", () => {
	const result = verifyGithubSignature(
		JSON.stringify({ ref: "refs/heads/main" }),
		"",
		"test-secret",
	);
	expect(result).to.equal(false);
});

test("verifyGithubSignature handles array header values", () => {
	const payload = JSON.stringify({ ref: "refs/heads/main" });
	const secret = "test-secret";

	const result = verifyGithubSignature(
		payload,
		[sign(payload, secret), "second-value"],
		secret,
	);
	expect(result).to.equal(true);
});
