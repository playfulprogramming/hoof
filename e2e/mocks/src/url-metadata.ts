import { mock } from "./mock.ts";

mock.taps.inject(
	{
		response: `
				<!DOCTYPE html>
				<html lang="en">
					<head>
						<title>Example Title</title>
					</head>
				</html>
				`,
		statusCode: 200,
		headers: { "Content-Type": "text/html" },
	},
	{
		url: "/",
		hostname: "example.com",
		method: "GET",
	},
);
