import User from "./User";
import getRandomInt from "./utils/getRandomInt";

class Company {
	public name: string;
	public code: number;
	public createdAt: Date;
	public owner: User;
	public peoples: number;

	constructor() {
		this.name = `Company ${getRandomInt(1, 100)}`;
		this.code = getRandomInt(1111, 9999);
		this.createdAt = new Date(getRandomInt(1700000000000, Date.now()));
		this.owner = new User();
		this.peoples = getRandomInt(10, 1000);
	}
}

export default Company;
