import pdfkit from "pdfkit";
import { Table } from "./Table";
import { equalFieldItems, getEmptyHeight, getRowHeight, printEmpty, printRow, Value, ValueKeys } from "./Value";
import { Header, PreparedHeader, prepareHeaders, printHeaders } from "./Header";
import { PreparedTableOptions, prepareTableOptions, TableOptions } from "./TableOptions";
import { getGroupedHeight, PreparedGrouped, printGrouped } from "./Grouped";
import { prepareGroupedSummaries, prepareSummary } from "./Summary";

function addPage(pdf: PDFKit, headers: PreparedHeader<any, any>[], heightHeader: number, grouped: PreparedGrouped<any> | null, current: Value | null, next: Value | null, { width, border, margins, header: headerAppearance, grouped: groupedAppearance, x }: Pick<PreparedTableOptions, "width" | "grouped" | "header" | "border" | "margins" | "x">) {
	pdf.addPage();
	pdf.x = x;
	printHeaders(pdf, headers, heightHeader, { width, border, margins, cell: headerAppearance });

	if (grouped && equalFieldItems(grouped, current, next))
		printGrouped(pdf, grouped, current, -1, { width, border, margins, cell: groupedAppearance });
}

class PDFKit extends pdfkit {
	private static _registeredFonts: Record<string, { src?: PDFKit.Mixins.PDFFontSource, family?: string }> = {};
	public static registerFont(name: string, src?: PDFKit.Mixins.PDFFontSource, family?: string) {
		this._registeredFonts[name] = { src, family };
		return this;
	}
	public static createTable<V extends Value = any>(data: V[], headers: Header<V, ValueKeys<V>>[]) {
		return new Table(data, headers);
	}

	constructor(options?: PDFKit.PDFDocumentOptions) {
		super(options);

		for (const name in PDFKit._registeredFonts) {
			const { src, family } = PDFKit._registeredFonts[name];
			this.registerFont(name, src, family);
		}
	}

	public createTable<V extends Value = any>(data: V[], headers: Header<V, ValueKeys<V>>[]) {
		return PDFKit.createTable(data, headers);
	}

	public table(table: Table<any>, options: TableOptions = {}): this {
		const { width, border, margins, x, y, forceBorderInContinue,
			cell: cellAppearance,
			header: headerAppearance,
			grouped: groupedAppearance,
			summary: summaryAppearance,
			groupedSummary: groupedSummaryAppearance
		} = prepareTableOptions(this, options);
		const { headers, columns, maxHeightCell } = prepareHeaders(this, table.headers, { width, border, cell: headerAppearance, margins });
		const heightHeader = maxHeightCell + border.width * 2;
		const heightLimit = this.page.height - this.page.margins.bottom;
		[this.x, this.y] = [x, y];


		const { data, grouped } = table;
		const summary = prepareSummary(this, table.summary, table.aggreagatesMap, columns, { border, margins, cell: summaryAppearance, width });
		const groupedSummary = prepareGroupedSummaries(this, table.groupedSummary, table.aggreagatesMap, columns, { width, margins, border, cell: groupedSummaryAppearance });
		let current = data.next();
		let next = data.next();
		const EMPTY_TEXT = table.emptyText;


		let heightRow = current.done ? getEmptyHeight(this, EMPTY_TEXT, { width, border, margins, cell: cellAppearance }) : getRowHeight(this, current.value, columns, { margins, border, cell: cellAppearance });
		let heightGrouped = getGroupedHeight(this, grouped, null, current.value, { width, margins, cell: groupedAppearance, border });
		let heightSummary = groupedSummary.getHeight(null as any, current.value);

		if (this.y + heightHeader + heightRow + heightGrouped > heightLimit) {
			this.addPage();
			this.x = x;
		}

		printHeaders(this, headers, heightHeader, { width, border, margins, cell: headerAppearance });
		if (current.done) {
			printEmpty(this, EMPTY_TEXT, heightRow, { width, margins, cell: cellAppearance, border });
			return this;
		}

		while (!current.done) {
			summary.agg(current.value);
			groupedSummary.agg(current.value, current.value);

			const subNext = data.next();
			const nextHeightRow = getRowHeight(this, next.value, columns, { margins, border, cell: cellAppearance });
			const nextHeightGrouped = getGroupedHeight(this, grouped, current.value, next.value, { width, margins, cell: groupedAppearance, border });
			const nextHeightSummary = groupedSummary.getHeight(next.value, subNext.value);

			const canPrintNextRow = this.y + heightGrouped + heightRow + heightSummary.all + nextHeightRow + nextHeightGrouped + nextHeightSummary.all + (subNext.done ? summary.getHeight() : 0) <= heightLimit;
			if (!canPrintNextRow) {
				heightRow = heightLimit - this.y - heightSummary.all - heightGrouped;
			};

			printGrouped(this, grouped, current.value, heightGrouped, { width, border, margins, cell: groupedAppearance });
			printRow(this, current.value, columns, heightRow, forceBorderInContinue || heightSummary.all != 0 || canPrintNextRow, { width, margins, border, cell: cellAppearance });
			groupedSummary.print(heightSummary, current.value, forceBorderInContinue || canPrintNextRow);

			if (!canPrintNextRow)
				addPage(this, headers, heightHeader, grouped, current.value, next.value, {
					width, margins, border, x,
					grouped: groupedAppearance,
					header: headerAppearance
				});

			current = next;
			next = subNext;
			heightRow = nextHeightRow;
			heightGrouped = nextHeightGrouped;
			heightSummary = nextHeightSummary;
		}

		groupedSummary.print(heightSummary, current, true);
		summary.print(summary.getHeight());

		return this;
	}
}

export default PDFKit;
