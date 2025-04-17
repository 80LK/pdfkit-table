import { createWriteStream } from "fs";
import PDFKit from "../index";
import generateArray from "./utils/generateArray";
import Company from "./Company";
import { createServer } from "http";

if (process.argv.indexOf("--server") != -1 || process.argv.indexOf("-s") != -1) {
	const server = createServer((_, res) => {
		res.setHeader("content-type", "application/pdf")
		createPdf(res);
	});
	server.on("listening", () => console.log("Listening: http://localhost:8080/"))
	server.on("error", (e) => console.error("Error:", e));
	server.listen(8080)
} else {
	createPdf(createWriteStream("test.pdf"))
}

function fillPage(pdf: PDFKit) {
	return () => {
		pdf.rect(pdf.page.margins.left, 0, pdf.page.width - pdf.page.margins.left - pdf.page.margins.right, pdf.page.height).fill("lightgreen")
			.rect(0, pdf.page.margins.top, pdf.page.width, pdf.page.height - pdf.page.margins.bottom - pdf.page.margins.top).fill("pink")
			.rect(pdf.page.margins.left, pdf.page.margins.top, pdf.page.width - pdf.page.margins.left - pdf.page.margins.right, pdf.page.height - pdf.page.margins.bottom - pdf.page.margins.top).fill("lightskyblue")
			.fillColor("black")
	};
}

interface AVG { value: number; count: number; }
function createPdf(stream: NodeJS.WritableStream) {
	const pdf = new PDFKit();
	pdf.pipe(stream);
	pdf.on("pageAdded", fillPage(pdf))

	fillPage(pdf)();

	const table = pdf.createTable(
		[
			...generateArray(25, (i) => ({ i: i + 1, category: "Goverment", ...new Company(), code: Math.ceil((i + 1) / 10) * 1111, flags: Math.ceil((i + 1) / 5) })),
			...generateArray(25, (i) => ({ i: i + 26, category: "Private", ...new Company(), code: Math.ceil((i + 26) / 10) * 1111, flags: Math.ceil((i + 26) / 5) })),
			...generateArray(50, (i) => ({ i: i + 51, category: "Public", ...new Company(), code: Math.ceil((i + 51) / 10) * 1111, flags: Math.ceil((i + 51) / 5) })),
		],
		[
			{
				title: "#",
				value: "i",
				width: 30
			},
			// {
			// 	title: "Code",
			// 	value: "code",
			// 	width: 40
			// },
			// {
			// 	title: "Flags",
			// 	value: "flags",
			// 	width: 40
			// },
			// {
			// 	title: "Category",
			// 	value: "category",
			// },
			{
				title: "Name",
				value: "name",
			},
			{
				title: "Peoples",
				value: "peoples"
			},
			{
				title: "Created At",
				value: "createdAt"
			},
			{
				title: "Owner",
				headers: [
					{
						title: "Name",
						value: "owner.name"
					},
					{
						title: "Age",
						value: "owner.age",
						width: 40,
					},
					{
						title: "Date",
						value: "owner.date",
					}
				]
			}

		]
	)
		.setGrouped("category")
		.setSummary({
			title: "Summary",
			headers: ["code", { value: "owner.age", formats: { number: { fixed: 2 } } }, "owner.date"],
			value: { "owner.date": new Date() }
		})
		.addGroupedSummary({
			title: "Flags",
			grouped: ["code", "flags"],
			headers: [{ value: "peoples", formats: { number: { fixed: 0 } } }],
		})
		.addGroupedSummary({
			title: "join",
			empty: '-',
			joiner: '-',
			grouped: ["code", "flags"],
			headers: [{ value: "peoples", formats: { number: { fixed: 0 } } }],
		})
		.addGroupedSummary({
			title: "Code",
			grouped: ["code"],
			headers: [{ value: "owner.age", formats: { number: { fixed: 2 } } }],
			empty: '-'
		})
		.setAggregate("code", (next, state: Record<string, number> = {}) => {
			const s_code = next.toString();
			if (!state[s_code]) state[s_code] = 0;
			state[s_code]++;
			return state;
		}, (state) => {
			return Object.keys(state).reduce((r, code) => {
				if (state[code] < r.count)
					return { code, count: state[code] }

				return r;
			}, { code: "", count: Infinity }).code;
		})
		.setAggregate("owner.age",
			(next, state: AVG = { count: 0, value: 0 }) => ({ count: state.count + 1, value: state.value + next }),
			state => state.value / state.count
		)
		.setAggregate("peoples",
			(next, state: AVG = { count: 0, value: 0 }) => ({ count: state.count + 1, value: state.value + next }),
			state => state.value / state.count
		);



	const empty_table = pdf.createTable<any>([], [{ value: "0", title: "Header 0" }, { value: "1", title: "Header 1" }, { value: "2", title: "Header 2" }]);
	pdf
		.table(empty_table).text(" ")
		.table(empty_table.setEmtyText("Not have data")).text(" ")
		.table(table);


	pdf.end();

}
