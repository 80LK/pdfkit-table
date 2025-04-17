
function cachedOnce<T>(pred: () => T): () => T {
	let value: T | null = null;
	return () => value ?? (value = pred());
}

function cachedMap<T, A>(pred: (a: A) => T): (a: A) => T {
	const map: Map<A, T> = new Map();
	return (a: A) => {
		let _v = map.get(a);
		if (!_v) {
			_v = pred(a);
			map.set(a, _v);
		}
		return _v;
	};
}


export {
	cachedOnce,
	cachedMap,
};
