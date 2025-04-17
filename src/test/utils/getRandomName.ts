import getRandomInt from "./getRandomInt";

const englishNames = [
	"James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
	"William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
	"Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
	"Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
	"Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
	"Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
	"Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon",
	"Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
	"Nicholas", "Shirley", "Eric", "Angela", "Jonathan", "Helen", "Stephen", "Anna",
	"Larry", "Brenda", "Justin", "Pamela", "Scott", "Nicole", "Brandon", "Emma",
	"Frank", "Samantha", "Benjamin", "Katherine", "Gregory", "Christine", "Raymond", "Debra",
	"Samuel", "Rachel", "Patrick", "Catherine", "Alexander", "Carolyn", "Jack", "Janet"
];
const length = englishNames.length - 1;

function getRandomName() {
	return englishNames[getRandomInt(length)];
}


export default getRandomName;
