export function fakeJob<Data>(data: Data) {
	return {
		id: "[id]",
		data,
		signal: new AbortController().signal,
	};
}
