function getRandomInt(min: number, max: number = 0): number {
	if (min > max) [max, min] = [min, max];

	min = Math.ceil(min);
	max = Math.floor(max);

	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default getRandomInt;
