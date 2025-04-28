import PDFKit from "./index";
import { ALIGN, EMPTY_VALUE, Formats } from "./Header";
import { getHeightText, getValue, printText, stringifyValue, Value, ValueKeys } from "./Value";
import { PreparedTableOptions } from "./TableOptions";

type Grouped<V extends Value> = ValueKeys<V> | PreparedGrouped<V>;
interface PreparedGrouped<V extends Value> {
	value: ValueKeys<V>;
	formats: Formats;
	empty?: string;
}

function isGrouped<V extends Value>(g: Grouped<V>): g is PreparedGrouped<V> {
	return typeof g == "object" && g.hasOwnProperty("value") && g.hasOwnProperty("formats");
}
function getGroupedHeight(pdf: PDFKit, grouped: PreparedGrouped<any> | null, prevItem: Value | null, item: Value | null, { width, margins, cell, border }: Pick<PreparedTableOptions, "width" | "margins" | "cell" | "border">) {
	if (grouped == null || item == null) return 0;

	const raw_value = getValue(item, grouped.value);
	const value = stringifyValue(raw_value, grouped.formats, grouped.empty ?? EMPTY_VALUE);
	const height = getHeightText(pdf, value, { width, margins, font: cell.font }) + border.width;
	if (prevItem != null) {
		const prev_raw_value = getValue(prevItem, grouped.value);
		const prev_value = stringifyValue(prev_raw_value, grouped.formats, grouped.empty ?? EMPTY_VALUE);
		if (prev_value == value)
			return 0;
	}

	return height;
}

function printGrouped(pdf: PDFKit, grouped: PreparedGrouped<any> | null, item: Value | null, height: number, { width, margins, cell, border }: Pick<PreparedTableOptions, "width" | "margins" | "cell" | "border">) {
	if (height == -1) height = getGroupedHeight(pdf, grouped, null, item, { width, margins, cell, border });

	if (grouped == null || item == null || height == 0) return;

	const widthCell = width - border.width * 2;
	const heightCell = height - border.width;

	const raw_value = getValue(item, grouped.value);
	const value = stringifyValue(raw_value, grouped.formats, grouped.empty ?? EMPTY_VALUE);

	pdf.rect(pdf.x, pdf.y, width, height).fill(border.color);
	pdf.rect(pdf.x + border.width, pdf.y, widthCell, heightCell).fill(cell.background);
	printText(pdf, value, heightCell, ALIGN.CENTER, { width: widthCell, margins, cell });

	pdf.y += height;
}
export {
	isGrouped,
	getGroupedHeight,
	printGrouped,
};
export type {
	Grouped,
	PreparedGrouped
}
