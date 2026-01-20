import { extractLocale } from "./extractLocale.ts";

test("extracts 'en' from index.md", () => {
	expect(extractLocale("index.md")).toBe("en");
});

test("extracts 'es' from index.es.md", () => {
	expect(extractLocale("index.es.md")).toBe("es");
});

test("extracts 'pt' from index.pt.md", () => {
	expect(extractLocale("index.pt.md")).toBe("pt");
});

test("extracts longer locale codes like 'por' from index.por.md", () => {
	expect(extractLocale("index.por.md")).toBe("por");
});

test("returns 'en' for non-matching filenames", () => {
	expect(extractLocale("readme.md")).toBe("en");
	expect(extractLocale("index.txt")).toBe("en");
	expect(extractLocale("other.es.md")).toBe("en");
});

test("handles uppercase in filename (returns 'en' as no match)", () => {
	expect(extractLocale("index.ES.md")).toBe("en");
});
