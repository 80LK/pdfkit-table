import { Grouped, isGrouped, PreparedGrouped } from "./Grouped";
import { flatHeaders, Header, HeaderWithValue } from "./Header";
import { AggreagatesMap, Aggregate, BaseSummary, GroupedSummary, Summary } from "./Summary";
import { BaseValue, MappedValue, Value, ValueKeys } from "./Value";

class Table<V extends Value = any> {
	private _data: V[];
	private _headers: Header<V, ValueKeys<V>>[];
	private _columns: HeaderWithValue<V, ValueKeys<V>>[];
	private _grouped: PreparedGrouped<V> | null = null;
	private _summary: Summary<V> | null = null;
	private _groupedSummary: GroupedSummary<V>[] = [];
	private _aggs: AggreagatesMap<V> = new Map();
	private _emptyText: string = "No Data";
	private _title: string | null = null;

	public constructor(data: V[], headers: Header<V, ValueKeys<V>>[]) {
		this._data = data;
		this._headers = headers;
		this._columns = flatHeaders(headers);
	}

	public get headers(): Header<V, ValueKeys<V>>[] { return this._headers; }
	public get columns(): HeaderWithValue<V, ValueKeys<V>>[] { return this._columns; }
	public get grouped(): PreparedGrouped<V> | null { return this._grouped; }
	public get summary(): Summary<V> | null { return this._summary; }
	public get groupedSummary(): GroupedSummary<V>[] { return this._groupedSummary; }
	public get aggreagatesMap(): AggreagatesMap<V> { return this._aggs; }
	private * _dataIterator(): Generator<V> {
		const l = this._data.length;
		for (let i = 0; i < l; i++) {
			yield this._data[i];
		}
	}
	public get data(): Generator<V> { return this._dataIterator(); }
	public get emptyText(): string { return this._emptyText; }
	public get title(): string | null { return this._title; }


	public setGrouped(grouped: Grouped<V>): this {
		if (!isGrouped(grouped)) {
			const header = this.columns.find(c => c.value == grouped);

			grouped = { value: grouped, formats: header?.formats ?? {} };
		}

		this._grouped = grouped;
		return this;
	}
	private prepeareSummary<S extends BaseSummary<V>>(summary: S): S {
		summary.headers = this._columns.reduce((r, h) => {
			const header = summary.headers.find(sh => ((typeof sh == "object" ? sh.value : sh) == h.value));
			if (header) r.push(header)
			return r;
		}, [] as S["headers"])
		return summary;
	}
	public setSummary(summary: Summary<V>): this {
		this._summary = <any>this.prepeareSummary(summary);
		return this;
	}

	public addGroupedSummary(summary: GroupedSummary<V>): this {
		this._groupedSummary.push(<any>this.prepeareSummary(summary));
		return this;
	}

	public setAggregate<H extends ValueKeys<V>, _S>(header: H, next: (next: MappedValue<V>[H], state: _S) => _S, resolve: (state: _S) => BaseValue): this {
		this._aggs.set(header, { next, resolve });
		return this;
	}
	public getAggregate(header: ValueKeys<V>): Aggregate<any, any> | null {
		return this._aggs.get(header) ?? null;
	}

	public setEmptyText(text: string): this {
		this._emptyText = text;
		return this;
	}
	public setTitle(text: string | null): this {
		this._title = text;
		return this;
	}
}

export { Table };
