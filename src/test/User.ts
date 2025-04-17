import getRandomInt from "./utils/getRandomInt";
import getRandomName from "./utils/getRandomName";

class User {
	public name: string;
	public age: number;
	public date: Date;

	constructor() {
		this.name = getRandomName();
		this.age = getRandomInt(18, 30);
		this.date = new Date(getRandomInt(1700000000000, Date.now()));
	}
}

export default User;
