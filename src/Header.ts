import type PDFKit from "./index";
import { PreparedTableOptions } from "./TableOptions";
import deepLevels from "./utils/deepLevels";
import { BaseValue, getHeightText, MappedValue, printText, Value, ValueKeys } from "./Value";

type Align = "left" | "center" | "right";
enum ALIGN {
	LEFT = "left",
	CENTER = "center",
	RIGHT = "right"
}
enum SIZE {
	AUTO = 0
}

interface Formats {
	number?: {
		fixed?: number;
		precision?: number
	},
	date?: string
}

interface BaseHeader {
	title: string;
	align?: Align;
	width?: number;
	formats?: Formats;
}

interface HeaderWithValue<V extends Value, H extends ValueKeys<V>> extends BaseHeader {
	value: H;
	prepare?(value: MappedValue<V>[H]): BaseValue;
	empty?: string;
}

interface HeaderWithChilds<V extends Value, H extends ValueKeys<V>> extends BaseHeader {
	// headers: Header<V, H>[];
	headers: Headers<V, H>;
}

type Header<V extends Value, H extends ValueKeys<V>> = HeaderWithValue<V, H> | HeaderWithChilds<V, ValueKeys<V>>;
type Headers<V extends Value, H extends ValueKeys<V>> = { [K in H]: Header<V, K> }[H][];

interface PreparedBaseHeader {
	height: number;
}
interface PreparedHeaderWithValue<V extends Value, H extends ValueKeys<V>> extends PreparedBaseHeader, Required<HeaderWithValue<V, H>> { }
interface PreparedHeaderWithChilds<V extends Value, H extends ValueKeys<V>> extends PreparedBaseHeader, Required<HeaderWithChilds<V, H>> {
	headers: PreparedHeader<V, H>[];
}
type PreparedHeader<V extends Value, H extends ValueKeys<V>> = PreparedHeaderWithValue<V, H> | PreparedHeaderWithChilds<V, H>;

function isHeaderWithChilds<V extends Value, H extends ValueKeys<V>>(header: Header<V, H>): header is HeaderWithChilds<V, ValueKeys<V>>;
function isHeaderWithChilds<V extends Value, H extends ValueKeys<V>>(header: PreparedHeader<V, H>): header is PreparedHeaderWithChilds<V, H>;
function isHeaderWithChilds<V extends Value, H extends ValueKeys<V>>(header: Header<V, H> | PreparedHeader<V, H>): header is HeaderWithChilds<V, H> | PreparedHeaderWithChilds<V, H> {
	return header.hasOwnProperty("headers");
}
function flatHeaders<V extends Value>(headers: Headers<V, ValueKeys<V>>): HeaderWithValue<V, ValueKeys<V>>[] {
	return headers.flatMap(header => isHeaderWithChilds(header) ? flatHeaders(header.headers) : header) as HeaderWithValue<V, ValueKeys<V>>[];
}

type ReturnCalculateFreeWidth = { width: number, without: number };
function calculateFreeWidth(headers: Headers<any, any>, { width, border }: Pick<PreparedTableOptions, "width" | "border">, without: number = 0): ReturnCalculateFreeWidth {
	width -= border.width * (headers.length - 1);

	return headers.reduce((r, header) => {
		header.width = header.width ?? 0;

		if (isHeaderWithChilds(header)) {
			if (header.width != SIZE.AUTO) {
				r.width -= header.width;
				return r;
			}
			return calculateFreeWidth(header.headers, { width: r.width, border }, r.without);
		}

		if (header.width != SIZE.AUTO) {
			r.width -= header.width;
		} else {
			r.without++;
		}
		return r;
	}, { width, without } as ReturnCalculateFreeWidth);
}

function printHeader(pdf: PDFKit, item: PreparedHeader<any, any>, { border, cell, margins }: Pick<PreparedTableOptions, "border" | "cell" | "margins">) {
	pdf.x += border.width;

	pdf.rect(pdf.x, pdf.y, item.width, item.height).fill(cell.background);

	printText(pdf, item.title, item.height, item.align, { width: item.width, margins, cell });

	if (isHeaderWithChilds(item)) {
		pdf.y += item.height + border.width;

		pdf.x -= border.width;
		item.headers.forEach(item => printHeader(pdf, item, { border, cell, margins }));

		pdf.y -= item.height + border.width;
	} else {
		pdf.x += item.width;
	}
}
function printHeaders(pdf: PDFKit, items: PreparedHeader<any, any>[], height: number, { width, border, cell, margins }: Pick<PreparedTableOptions, "width" | "border" | "cell" | "margins">) {
	const { x, y } = pdf;

	pdf.rect(pdf.x, pdf.y, width, height).fill(border.color);

	pdf.y += border.width;

	items.forEach(item => printHeader(pdf, item, { border, cell, margins }));

	pdf.y = y + height;
	pdf.x = x;
}

function getHeightTitle(pdf: PDFKit, title: string | null, { width, margins, title: titleAppearance }: Pick<PreparedTableOptions, "width" | "margins" | "title">) {
	if (title == null) return 0;
	return getHeightText(pdf, title, { width, margins, font: titleAppearance.font })
}

function printTitle(pdf: PDFKit, title: string | null, height: number, { width, margins, title: titleAppearance }: Pick<PreparedTableOptions, "width" | "margins" | "title">) {
	if (!title) return;

	printText(pdf, title, height, titleAppearance.align, { width, cell: titleAppearance, margins });
	pdf.y += height;
}

const EMPTY_VALUE = '';
function prepareHeaders<V extends Value, H extends ValueKeys<V>>(
	pdf: PDFKit,
	headers: Headers<V, H>,
	{ margins, width, border, cell }: Pick<PreparedTableOptions, "margins" | "width" | "border" | "cell">
) {
	width -= border.width * 2;

	const preparedHeaders: PreparedHeader<V, H>[] = [];
	const columns: PreparedHeaderWithValue<V, H>[] = [];

	function processHeaders(
		headers: Headers<V, H>,
		availableWidth: number,
		autoWidth: number
	): { width: number; headers: PreparedHeader<V, H>[], height: number } {
		let totalWidth = 0;
		let maxHeight = 0;

		const processedHeaders = headers.map(header => {
			const headerWidth = header.width ?? SIZE.AUTO;

			if (isHeaderWithChilds(header)) {
				const headers = header.headers as Headers<V, H>;
				const childResult = headerWidth === SIZE.AUTO
					? processHeaders(headers, availableWidth, autoWidth)
					: (() => {
						const { width, without } = calculateFreeWidth(headers as Headers<any, any>, { width: headerWidth, border });
						return processHeaders(
							headers,
							headerWidth,
							width / without
						)
					})();

				const calculatedWidth = headerWidth === SIZE.AUTO
					? childResult.width + Math.max(headers.length - 1, 0) * border.width
					: headerWidth;

				const headerTextHeight = getHeightText(pdf, header.title, {
					width: calculatedWidth,
					margins,
					font: cell.font,
				});

				const totalHeight = headerTextHeight + border.width + childResult.height;
				maxHeight = Math.max(maxHeight, totalHeight);

				const preparedHeader: PreparedHeaderWithChilds<V, H> = {
					title: header.title,
					width: calculatedWidth,
					height: SIZE.AUTO,
					formats: header.formats || {},
					align: header.align || ALIGN.CENTER,
					headers: childResult.headers,
				};

				totalWidth += calculatedWidth;
				return preparedHeader;
			} else {
				const calculatedWidth = headerWidth === SIZE.AUTO ? autoWidth : headerWidth;
				const headerHeight = getHeightText(pdf, header.title, { width: calculatedWidth, margins, font: cell.font });
				maxHeight = Math.max(maxHeight, headerHeight);

				const preparedHeader: PreparedHeaderWithValue<V, H> = {
					title: header.title,
					width: calculatedWidth,
					height: SIZE.AUTO,
					formats: header.formats || {},
					align: header.align || ALIGN.CENTER,
					value: header.value,
					empty: header.empty ?? EMPTY_VALUE,
					prepare: header.prepare ?? (v => v as BaseValue)
				};

				columns.push(preparedHeader);
				totalWidth += calculatedWidth;
				return preparedHeader;
			}
		});

		return { width: totalWidth, headers: processedHeaders, height: maxHeight };
	}

	const freeWidthResult = calculateFreeWidth(headers as Headers<any, any>, { width, border });
	const autoWidth = freeWidthResult.width / freeWidthResult.without;

	const { headers: processedHeaders, height: maxHeight } = processHeaders(headers, width, autoWidth);

	// Установка высоты заголовков
	function setHeight(headers: PreparedHeader<V, H>[], height: number, _deep: number = 0) {
		headers.forEach(header => {
			if (isHeaderWithChilds(header)) {
				const deep = deepLevels(header, h => h.headers);
				const autoHeight = (height - border.width * deep) / (deep + 1);
				const headerHeight = Math.max(
					autoHeight,
					getHeightText(pdf, header.title, { width: header.width, margins, font: cell.font })
				);

				setHeight(header.headers, height - headerHeight - border.width, _deep++);
				header.height = headerHeight;
			} else {
				header.height = height;
			}
		});
	}

	setHeight(processedHeaders, maxHeight);
	return {
		headers: processedHeaders,
		maxHeightCell: maxHeight,
		columns,
	};
}

export {
	ALIGN,
	SIZE,

	flatHeaders,
	isHeaderWithChilds,

	prepareHeaders,
	printHeaders,

	getHeightTitle,
	printTitle,

};

export type {
	Align,
	Formats,

	BaseHeader,

	Header,
	HeaderWithChilds,
	HeaderWithValue,
	Headers,

	PreparedHeader,
	PreparedHeaderWithChilds,
	PreparedHeaderWithValue,
};
