import { isGrouped, PreparedGrouped } from "./Grouped";
import { ALIGN, Align, Formats, PreparedHeaderWithValue } from "./Header";
import type PDFKit from "./index";
import { PreparedTableOptions } from "./TableOptions";

type BaseValue = string | number | Date | null;
type Value = BaseValue[] | Record<string, any>;

type MappedValue<T extends Value, Prefix extends string = "", Depth extends number[] = []> =
	Depth["length"] extends 5 ? {} :
	{
		[K in Extract<keyof T, T extends any[] ? number : string>]:
		T[K] extends BaseValue
		? { [key in `${Prefix}${K}`]: T[K] }
		: T[K] extends object
		? MappedValue<T[K], `${Prefix}${K}.`, [0, ...Depth]>
		: never
	}[Extract<keyof T, T extends any[] ? number : string>] extends infer O
	? UnionToIntersection<O>
	: never;

type UnionToIntersection<U> =
	(U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type ValueKeys<V extends Value> = keyof MappedValue<V>;

function getValue<V extends Value, K extends ValueKeys<V>>(obj: V, key: K | string | number): MappedValue<V>[K] {
	if (typeof key === "number")
		return <any>obj[<keyof V>key];

	if (typeof key !== "string")
		throw new ReferenceError(`Key is type ${typeof key}: ${JSON.stringify(key)}`);

	const [_key, ..._keys] = key.split(".");
	const value: any = obj[<keyof V>_key];

	if (_keys.length) {
		return getValue(value, _keys.join("."));
	}

	return value;
}
function getHeightText(pdf: PDFKit, value: string, { width, margins, font }: Pick<PreparedTableOptions, "margins" | "width"> & { font: PreparedTableOptions['cell']['font'] }) {
	return pdf.font(font.src, font.size).heightOfString(value, {
		width: width - margins.left - margins.right,
	}) + margins.top + margins.bottom
}
function stringifyValue(value: BaseValue | undefined, formats: Formats = {}, empty: string) {
	if (typeof value === "number") {
		if (formats.number?.precision) return value.toPrecision(formats.number.precision);
		if (formats.number?.fixed) return value.toFixed(formats.number.fixed);

		return value.toString()
	};

	if (value instanceof Date) {
		if (formats.date)
			return value.toLocaleString(formats.date)
		return value.toLocaleString()
	};

	if (typeof value === "string" && value.length == 0) return empty;

	return value ?? empty;
}
function printText(pdf: PDFKit, value: string, height: number, align: Align, { width, margins, cell }: Pick<PreparedTableOptions, "width" | "cell" | "margins">) {
	const w = width - margins.left - margins.right;
	const heightInLine = getHeightText(pdf, value, { width: Infinity, margins: { left: 0, right: 0, top: 0, bottom: 0 }, font: cell.font });
	const heightText = getHeightText(pdf, value, { width: w, margins: { left: 0, right: 0, top: 0, bottom: 0 }, font: cell.font });
	const free_space = height - heightText - margins.top - margins.bottom;
	const { x, y } = pdf;

	pdf.fillColor(cell.color)
		.font(cell.font.src, cell.font.size)
		.text(value,
			x + margins.left,
			y + margins.top + heightInLine + free_space / 2,
			{
				align,
				baseline: "bottom",
				width: w,
				height: height + margins.bottom
			});

	[pdf.x, pdf.y] = [x, y];
}

function getRowHeight(pdf: PDFKit, value: Value | null, columns: PreparedHeaderWithValue<any, any>[], { margins, cell, border }: Pick<PreparedTableOptions, "border" | "margins" | "cell">) {
	if (value == null) return 0;
	return columns.reduce((r, h) => Math.max(r, getHeightText(pdf, stringifyValue(getValue(value, h.value), h.formats, h.empty), { width: h.width, margins, font: cell.font })), 0) + border.width;
}
function printRow(pdf: PDFKit, item: Value, columns: PreparedHeaderWithValue<any, any>[], height: number, bottomBorder: boolean, { width, margins, cell, border }: Pick<PreparedTableOptions, "border" | "width" | "margins" | "cell">) {
	pdf.rect(pdf.x, pdf.y, width, height).fill(border.color);
	const { x, y } = pdf;
	const heightRow = height - (bottomBorder ? border.width : 0);

	columns.forEach(column => {
		pdf.x += border.width;
		pdf.rect(pdf.x, pdf.y, column.width, heightRow).fill(cell.background);

		const value = stringifyValue(getValue(item, column.value), column.formats, column.empty);
		printText(pdf, value, heightRow, column.align, { width: column.width, margins, cell });
		pdf.x += column.width;
	});

	[pdf.x, pdf.y] = [x, y + height];
}

function getEmptyHeight(pdf: PDFKit, text: string, { width, margins, cell, border }: Pick<PreparedTableOptions, "border" | "width" | "margins" | "cell">) {
	return getHeightText(pdf, text, { width, margins, font: cell.font }) + border.width;
}
function printEmpty(pdf: PDFKit, text: string, height: number, { width, margins, cell, border }: Pick<PreparedTableOptions, "border" | "width" | "margins" | "cell">) {
	pdf.rect(pdf.x, pdf.y, width, height).fill(border.color);

	const { x, y } = pdf;
	const heightCell = height - border.width;
	const widthCell = width - border.width * 2;

	pdf.x += border.width;
	pdf.rect(pdf.x, pdf.y, widthCell, heightCell).fill(cell.background);
	printText(pdf, text, heightCell, ALIGN.CENTER, { width: widthCell, margins, cell });

	[pdf.x, pdf.y] = [x, y + height];
}

function equalFieldItems(fields: ValueKeys<any> | PreparedGrouped<any> | (ValueKeys<any> | PreparedGrouped<any>)[], itemA: any | null, itemB: any | null): boolean {
	if (itemA == null || itemB == null) return false;
	if (!Array.isArray(fields)) fields = [fields];

	for (let field of fields) {
		if (!isGrouped(field))
			field = { value: field, formats: {} };

		const valueA = stringifyValue(getValue(itemA, field.value), field.formats, "");
		const valueB = stringifyValue(getValue(itemB, field.value), field.formats, "");
		if (valueA !== valueB)
			return false;
	}

	return true;
}

export {
	getValue,
	getHeightText,

	stringifyValue,
	printText,

	getRowHeight,
	printRow,
	equalFieldItems,

	getEmptyHeight,
	printEmpty,
}

export type {
	BaseValue,
	Value,
	MappedValue,
	ValueKeys,
}
