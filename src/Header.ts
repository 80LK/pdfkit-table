import type PDFKit from "./index";
import { PreparedTableOptions } from "./TableOptions";
import deepLevels from "./utils/deepLevels";
import { getHeightText, printText, Value, ValueKeys } from "./Value";

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
}

interface HeaderWithChilds<V extends Value, H extends ValueKeys<V>> extends BaseHeader {
	headers: Header<V, H>[];
}

type Header<V extends Value, H extends ValueKeys<V>> = HeaderWithValue<V, H> | HeaderWithChilds<V, H>;

interface PreparedBaseHeader {
	height: number;
}
interface PreparedHeaderWithValue<V extends Value, H extends ValueKeys<V>> extends PreparedBaseHeader, Required<HeaderWithValue<V, H>> { }
interface PreparedHeaderWithChilds<V extends Value, H extends ValueKeys<V>> extends PreparedBaseHeader, Required<HeaderWithChilds<V, H>> {
	headers: PreparedHeader<V, H>[];
}
type PreparedHeader<V extends Value, H extends ValueKeys<V>> = PreparedHeaderWithValue<V, H> | PreparedHeaderWithChilds<V, H>;

function isHeaderWithChilds<V extends Value, H extends ValueKeys<V>>(header: Header<V, H>): header is HeaderWithChilds<V, H>;
function isHeaderWithChilds<V extends Value, H extends ValueKeys<V>>(header: PreparedHeader<V, H>): header is PreparedHeaderWithChilds<V, H>;
function isHeaderWithChilds<V extends Value, H extends ValueKeys<V>>(header: Header<V, H> | PreparedHeader<V, H>): header is HeaderWithChilds<V, H> | PreparedHeaderWithChilds<V, H> {
	return header.hasOwnProperty("headers");
}
function flatHeaders<V extends Value, H extends ValueKeys<V>>(headers: Header<V, H>[]): HeaderWithValue<V, H>[] {
	return headers.flatMap(header => isHeaderWithChilds(header) ? flatHeaders(header.headers) : header) as HeaderWithValue<V, H>[];
}

type ReturnCalculateFreeWidth = { width: number, without: number };
function calculateFreeWidth(headers: Header<any, any>[], { width, border }: Pick<PreparedTableOptions, "width" | "border">, without: number = 0): ReturnCalculateFreeWidth {
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
type ReturnSetHeadersWidth = { width: number; headers: PreparedHeader<any, any>[]; columns: PreparedHeaderWithValue<any, any>[] };
function setHeadersWidth(headers: Header<any, any>[], auto_width: number, border: PreparedTableOptions["border"]): ReturnSetHeadersWidth {
	return headers.reduce((r, header) => {
		header.width = header.width ?? SIZE.AUTO;

		if (isHeaderWithChilds(header)) {
			let _setHeadersWidth: ReturnSetHeadersWidth;
			if (header.width == SIZE.AUTO) {
				_setHeadersWidth = setHeadersWidth(header.headers, auto_width, border);
				header.width = _setHeadersWidth.width + Math.max(header.headers.length - 1, 0) * border.width;
			} else {
				const v = calculateFreeWidth(headers, { width: header.width, border });
				const auto_width = v.width / v.without;
				_setHeadersWidth = setHeadersWidth(header.headers, auto_width, border);
			}

			r.headers.push({
				title: header.title,
				width: header.width,
				height: SIZE.AUTO,
				formats: header.formats || {},
				align: header.align || ALIGN.CENTER,
				headers: _setHeadersWidth.headers
			})
			r.columns = r.columns.concat(_setHeadersWidth.columns);
		} else {
			if (header.width == SIZE.AUTO)
				header.width = auto_width;

			const pHeader: PreparedHeaderWithValue<any, any> = {
				title: header.title,
				width: header.width,
				height: SIZE.AUTO,
				formats: header.formats || {},
				align: header.align || ALIGN.CENTER,
				value: header.value
			};
			r.headers.push(pHeader);
			r.columns.push(pHeader);
		}

		r.width += header.width;
		return r;
	}, { width: 0, headers: [] as PreparedHeader<any, any>[], columns: [] as PreparedHeaderWithValue<any, any>[] });
}

function calculateMaxHeight(pdf: PDFKit, headers: PreparedHeader<any, any>[], { margins, border, cell }: Pick<PreparedTableOptions, "margins" | "border" | "cell">): number {
	return headers.reduce((r, header) => {
		const height = getHeightText(pdf, header.title, { width: header.width, margins, font: cell.font });

		if (isHeaderWithChilds(header))
			return Math.max(r, height + border.width + calculateMaxHeight(pdf, header.headers, { border, margins, cell }));


		return Math.max(r, height);
	}, 0)
}
function setHeadersHeight(pdf: PDFKit, headers: PreparedHeader<any, any>[], height: number, { margins, border, cell }: Pick<PreparedTableOptions, "cell" | "border" | "margins">) {
	headers.map(header => {
		if (isHeaderWithChilds(header)) {
			const deep = deepLevels(header, (header) => header.headers);
			const auto_height = (height - border.width * deep) / (deep + 1);
			const hHeight = Math.max(auto_height, getHeightText(pdf, header.title, { width: header.width, margins, font: cell.font }));

			setHeadersHeight(pdf, header.headers, height - hHeight - border.width, { margins, border, cell });
			header.height = hHeight;
		} else {
			header.height = height;
		}
	})
}

function prepareHeaders<V extends Value, H extends ValueKeys<V>>(pdf: PDFKit, headers: Header<V, H>[], { margins, width, border, cell }: Pick<PreparedTableOptions, "margins" | "width" | "border" | "cell">) {
	width -= border.width * 2;

	const v = calculateFreeWidth(headers, { width, border });
	const auto_width = v.width / v.without;
	const { headers: pHeaders, columns } = setHeadersWidth(headers, auto_width, border);

	const maxHeightCell = calculateMaxHeight(pdf, pHeaders, { margins, border, cell });
	setHeadersHeight(pdf, pHeaders, maxHeightCell, { border, margins, cell });

	return {
		headers: pHeaders,
		maxHeightCell, columns
	};
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

	PreparedHeader,
	PreparedHeaderWithChilds,
	PreparedHeaderWithValue,
};
