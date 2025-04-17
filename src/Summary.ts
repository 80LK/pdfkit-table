import { cachedMap, cachedOnce } from "./utils/cached";
import PDFKit from "./index";
import { ALIGN, Align, Formats, PreparedHeaderWithValue } from "./Header";
import { BaseValue, equalFieldItems, getHeightText, getValue, printText, stringifyValue, Value, ValueKeys } from "./Value";
import { PreparedTableOptions } from "./TableOptions";
import { Grouped } from "./Grouped";


interface SummaryHeader<V extends Value> {
	value: ValueKeys<V>;
	align?: Align;
	formats?: Formats;
}
type Header<V extends Value> = ValueKeys<V> | SummaryHeader<V>;


type SummaryValue<V extends Value, Keys extends ValueKeys<V>> = { [Key in Keys]?: BaseValue }

interface BaseSummary<V extends Value> {
	title: string;
	headers: Header<V>[];
}
interface Summary<V extends Value> extends BaseSummary<V> {
	value?: SummaryValue<V, ValueKeys<V>>;
}

interface GroupedSummary<V extends Value> extends BaseSummary<V> {
	grouped: Grouped<V>[];
	value?: SummaryValue<V, ValueKeys<V>>[];
}
interface Aggregate<V, S> {
	next(next: V, state: S): S;
	resolve(state: S): BaseValue;
}
type AggreagatesMap<V extends Value> = Map<ValueKeys<V>, Aggregate<any, any>>;

function createSimpleSummaryHeader(title: string, align: Align = ALIGN.CENTER): PreparedSummaryHeader<never> {
	return {
		width: 0,
		raw_value: title,
		align
	}
}

function toSummaryHeader(header: Header<any>): SummaryHeader<any> {
	if (typeof header == "object") return header;
	return { value: header }
}


interface PreparedSummaryHeader<V extends Value> {
	width: number;
	align: Align;
	value?: ValueKeys<V>;
	raw_value?: string;
	formats?: Formats;
}
function prepareSummaryHeaders(title: string, summaryHeaders: Header<any>[], headers: PreparedHeaderWithValue<any, any>[], border: number) {
	const EMPTY_TEXT = "-";
	let cellData = createSimpleSummaryHeader(title, ALIGN.LEFT);
	let currentSummerHeaderI = 0;
	let currentSummerHeader = toSummaryHeader(summaryHeaders[currentSummerHeaderI++]);
	const columns = [] as PreparedSummaryHeader<any>[];
	for (const header of headers) {
		if (header.value == currentSummerHeader.value) {
			if (cellData.width != 0) {
				columns.push(cellData);
			}

			columns.push({ width: header.width, value: header.value, align: currentSummerHeader.align ?? header.align, formats: currentSummerHeader.formats ?? header.formats });
			currentSummerHeader = toSummaryHeader(summaryHeaders[currentSummerHeaderI++]);
			cellData = createSimpleSummaryHeader(EMPTY_TEXT);
			continue;
		}

		if (cellData.width != 0) cellData.width += border;
		cellData.width += header.width;
	}
	if (cellData.width != 0) columns.push(cellData);
	return columns;
}


interface PreparedSummary {
	agg(item: Value): void;
	getHeight(): number;
	print(height: number): void;
}
function prepareSummary(pdf: PDFKit, summary: Summary<any> | null, aggMaps: AggreagatesMap<any>, headers: PreparedHeaderWithValue<any, any>[], { border, margins, cell, width }: Pick<PreparedTableOptions, "width" | "border" | "margins" | "cell">): PreparedSummary {
	if (!summary) return { agg() { }, getHeight() { return 0 }, print() { } };
	const EMPTY_TEXT = "-";
	const columns = prepareSummaryHeaders(summary.title, summary.headers, headers, border.width);
	let summaryValue = {} as Record<ValueKeys<any>, any>;
	const getSummaryValue = cachedOnce(() => Object.assign({},
		summary.headers.reduce((r, h) => {
			const key = typeof h == "object" ? h.value : h;
			r[key] = aggMaps.get(key)?.resolve(r[key]);
			return r;
		}, summaryValue) as SummaryValue<any, any>,
		summary.value
	))

	return {
		agg(item: Value) {
			summaryValue = summary.headers.reduce((r, h) => {
				const key = typeof h == "object" ? h.value : h;
				r[key] = aggMaps.get(key)?.next(getValue(item, key), r[key]);
				return r;
			}, summaryValue)
		},
		getHeight() {
			const value = getSummaryValue();
			return columns.reduce((r, h) => {
				const height = getHeightText(pdf, h.value ? stringifyValue(value[h.value] || EMPTY_TEXT, h.formats) : h.raw_value || EMPTY_TEXT, { width: h.width, margins, cell });
				return Math.max(r, height)
			}, 0) + border.width;
		},
		print(height: number) {
			const value = getSummaryValue();
			const heightCell = height - border.width;

			pdf.rect(pdf.x, pdf.y, width, height).fill(border.color);
			let x = pdf.x;
			for (const item of columns) {
				pdf.x += border.width;

				pdf.rect(pdf.x, pdf.y, item.width, heightCell).fill(cell.background);
				const text = item.value ? stringifyValue(value[item.value] || EMPTY_TEXT, item.formats) : item.raw_value || EMPTY_TEXT;
				printText(pdf, text, heightCell, item.align, { margins, cell, width: item.width });

				pdf.x += item.width;
			}
			pdf.x = x;
			pdf.y += height;
		},
	}
}
interface PreparedGroupedSummary<H> {
	agg(item: Value, prev: Value | null): void;
	getHeight(prev: Value, cur: Value | null): H;
	print(height: H, cur: Value, bottmBorder: boolean): void;
}
interface GroupedSummariesHeight {
	all: number;
	items: number[];
	last: number;
}
const TITLE_REPLACER = "%TITLE%";
function prepareGroupedSummary(pdf: PDFKit, summary: GroupedSummary<any>, aggMaps: AggreagatesMap<any>, headers: PreparedHeaderWithValue<any, any>[], { border, margins, cell, width }: Pick<PreparedTableOptions, "width" | "border" | "margins" | "cell">): PreparedGroupedSummary<number> {
	const EMPTY_TEXT = "-";
	const JOINER = ",";
	const columns = prepareSummaryHeaders(TITLE_REPLACER, summary.headers, headers, border.width)
	let summaryValue = {} as Record<ValueKeys<any>, any>;
	const getSummaryValue = cachedMap((item: Value) => Object.assign({},
		summary.grouped.reduce((r, h) => {
			const key = typeof h == "object" ? h.value : h;
			r[key] = getValue(item, key)
			return r;
		}, {} as Record<ValueKeys<any>, any>),
		summary.headers.reduce((r, h) => {
			const key = typeof h == "object" ? h.value : h;
			r[key] = aggMaps.get(key)?.resolve(r[key]);
			return r;
		}, summaryValue) as SummaryValue<any, any>,
		summary.value?.find(i => equalFieldItems(summary.grouped, i, item)) ?? {}
	))

	return {
		agg(curr, prev) {
			summaryValue = summary.headers.reduce((r, h) => {
				const key = typeof h == "object" ? h.value : h;
				r[key] = aggMaps.get(key)?.next(getValue(curr, key), r[key]) ?? r[key];
				return r;
			}, equalFieldItems(summary.grouped, curr, prev) ? summaryValue : {})
		},
		getHeight(curr, next) {
			if (next != null && equalFieldItems(summary.grouped, curr, next))
				return 0;

			const value = getSummaryValue(curr);
			const height = columns.reduce((r, h) => {
				const text = h.value
					? stringifyValue(value[h.value] || EMPTY_TEXT, h.formats)
					: h.raw_value == TITLE_REPLACER
						? `${summary.title}: ${summary.grouped.map(h => value[typeof h == "object" ? h.value : h]).join(JOINER)}`
						: h.raw_value || EMPTY_TEXT;
				const height = getHeightText(pdf, text, { width: h.width, margins, cell });
				return Math.max(r, height)
			}, 0) + border.width;

			return height;
		},
		print(height: number, curr, bottomBorder) {
			if (height == 0) return;
			const value = getSummaryValue(curr);

			const heightCell = height - (bottomBorder ? border.width : 0);

			pdf.rect(pdf.x, pdf.y, width, height).fill(border.color);
			let x = pdf.x;
			for (const item of columns) {
				pdf.x += border.width;

				pdf.rect(pdf.x, pdf.y, item.width, heightCell).fill(cell.background);
				const text = item.value
					? stringifyValue(value[item.value] || EMPTY_TEXT, item.formats)
					: item.raw_value == TITLE_REPLACER
						? `${summary.title}: ${summary.grouped.map(h => value[typeof h == "object" ? h.value : h]).join(JOINER)}`
						: item.raw_value || EMPTY_TEXT;
				printText(pdf, text, heightCell, item.align, { margins, cell, width: item.width });

				pdf.x += item.width;
			}
			pdf.x = x;
			pdf.y += height;
			summaryValue = {};
		}
	}
}
function prepareGroupedSummaries(pdf: PDFKit, summaries: GroupedSummary<any>[], aggMaps: AggreagatesMap<any>, headers: PreparedHeaderWithValue<any, any>[], { border, margins, cell, width }: Pick<PreparedTableOptions, "width" | "border" | "margins" | "cell">): PreparedGroupedSummary<GroupedSummariesHeight> {
	if (!summaries.length) return { agg() { }, getHeight() { return { all: 0, items: [], last: -1 } }, print() { } };
	const pSummaries = summaries.map(s => prepareGroupedSummary(pdf, s, aggMaps, headers, { width, border, margins, cell }));
	return {
		agg(item, prev) { pSummaries.forEach(s => s.agg(item, prev)) },
		getHeight(prev, cur) {
			if (prev == null) return { all: 0, items: [], last: -1 }
			const h = pSummaries.reduce((r, s) => {
				const h = s.getHeight(prev, cur);
				r.all += h;
				const i = r.items.push(h);
				if (h) r.last = i - 1;
				return r;
			}, { all: 0, items: [] as number[], last: -1 });
			return h;
		},
		print(height, curr, bottomBorder) {
			pSummaries.forEach((s, i) => s.print(height.items[i] || 0, curr, i == height.last ? bottomBorder : true));
		}
	}
}

export {
	prepareSummary,
	prepareGroupedSummaries,
}
export type {
	SummaryHeader,
	SummaryValue,
	BaseSummary,
	Summary,
	GroupedSummary,
	Aggregate,
	AggreagatesMap,
}
