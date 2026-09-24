export function extractLocale(filename: string): string {
	const match = filename.match(/index\.([a-z]+)\.md$/);
	return match?.[1] ?? "en";
}
