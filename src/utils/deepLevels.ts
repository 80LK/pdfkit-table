function deepLevels<T>(arr: T, predicate: (el: T) => any | T[]): number {
	const el = predicate(arr);
	if (!Array.isArray(el)) return 0;

	return el.reduce((lvl, el) => Math.max(lvl, deepLevels(el, predicate) + 1), 1);
}

export default deepLevels;
