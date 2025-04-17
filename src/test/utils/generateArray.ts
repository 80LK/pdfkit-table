function generateArray<T>(length: number, generator: (i: number) => T, arr: T[] = []): T[] {
	for (let i = 0; i < length; i++) {
		const item = generator(i);
		arr.push(item);
	}
	return arr;
}

export default generateArray;
