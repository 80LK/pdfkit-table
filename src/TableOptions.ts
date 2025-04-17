import type PDFKit from "./index";

// BORDER
type Border = number | PDFKit.Mixins.ColorValue | PreparedBorder;
interface PreparedBorder {
	width: number;
	color: PDFKit.Mixins.ColorValue;
}
function isBorder(border: Border): border is PreparedBorder {
	return typeof border == "object" && border.hasOwnProperty("width") && border.hasOwnProperty("color");
}
function prepareBorder(def: PreparedBorder, border: Border = def): PreparedBorder {
	if (isBorder(border))
		return border;

	if (typeof border == "number")
		border = { width: border, color: def.color };
	else
		border = { width: def.width, color: border };

	return border
}

// MARGINS
type Margins = number | _2WayMargins | PreparedMargins;
interface _2WayMargins { h: number, v: number };
interface PreparedMargins {
	left: number; right: number;
	top: number; bottom: number;
}
function is2WayMargins(margins: Margins): margins is _2WayMargins {
	return typeof margins === "object" && margins.hasOwnProperty("v") && margins.hasOwnProperty("h");
}
function prepareMargins(def: Margins, margins: Margins = def): PreparedMargins {
	if (typeof margins == "number")
		margins = { v: margins, h: margins };

	if (is2WayMargins(margins))
		margins = {
			left: margins.h, right: margins.h,
			top: margins.v, bottom: margins.v,
		}

	return margins;
}

interface Font {
	src: PDFKit.Mixins.PDFFontSource;
	size: number;
}
function isFont(f: number | PDFKit.Mixins.PDFFontSource | Font): f is Font {
	return typeof f == "object" && f.hasOwnProperty("src") && f.hasOwnProperty("size");
}

// CELLAPPEARANCE
interface CellAppearance {
	background?: PDFKit.Mixins.ColorValue;
	color?: PDFKit.Mixins.ColorValue;
	font?: number | PDFKit.Mixins.PDFFontSource | Font
}
interface PreparedCellAppearance {
	background: PDFKit.Mixins.ColorValue;
	color: PDFKit.Mixins.ColorValue;
	font: Font;
}
function prepareFont(def: Font, font?: number | PDFKit.Mixins.PDFFontSource | Font): Font {
	def = Object.assign({}, def);

	if (!font) return def;
	if (isFont(font)) return font;

	if (typeof font == "number")
		def.size = font;
	else
		def.src = font;

	return def;
}
function prepareCellAppearance(def: PreparedCellAppearance, appearance: CellAppearance = {}): PreparedCellAppearance {
	def = Object.assign({}, def, { font: Object.assign({}, def.font) });

	def.background = appearance.background ?? def.background;
	def.color = appearance.color ?? def.color;
	def.font = prepareFont(def.font, appearance.font);
	return def;
}


interface TableOptions extends CellAppearance {
	x?: number;
	y?: number;

	width?: number;
	border?: Border;
	margins?: Margins;

	header?: CellAppearance;
	cell?: CellAppearance;
	grouped?: CellAppearance;
	summary?: CellAppearance;
	groupedSummary?: CellAppearance;

	forceBorderInContinue?: boolean;
}
interface PreparedTableOptions {
	x: number;
	y: number;

	width: number;
	border: PreparedBorder;
	margins: PreparedMargins;

	header: PreparedCellAppearance;
	cell: PreparedCellAppearance;
	grouped: PreparedCellAppearance;
	summary: PreparedCellAppearance;
	groupedSummary: PreparedCellAppearance;

	forceBorderInContinue: boolean;
}

function prepareTableOptions(pdf: PDFKit, options: TableOptions): PreparedTableOptions {
	const header = prepareCellAppearance({ background: "#ccc", color: "#000", font: { src: "Helvetica-Bold", size: 12 } }, options.header);
	const cell = prepareCellAppearance(
		prepareCellAppearance(
			{ background: "#fff", color: "#000", font: { src: "Helvetica", size: 12 } },
			{ background: options.background, color: options.color, font: options.font }
		),
		options.cell
	);
	const summary = prepareCellAppearance(header, options.summary);

	return {
		x: options.x ?? pdf.x,
		y: options.y ?? pdf.y,

		width: options.width ?? pdf.page.width - pdf.page.margins.left - pdf.page.margins.right,
		border: prepareBorder({ color: "#000", width: 3 }, options.border),
		margins: prepareMargins(3, options.margins),

		cell, header, summary,
		grouped: prepareCellAppearance(header, options.grouped),
		groupedSummary: prepareCellAppearance(summary, options.groupedSummary),

		forceBorderInContinue: options.forceBorderInContinue ?? false
	}
}

export {
	prepareTableOptions,
}

export type {
	TableOptions,
	PreparedTableOptions,
}
