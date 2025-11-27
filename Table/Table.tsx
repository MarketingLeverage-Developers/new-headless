import React, { createContext, useContext, useMemo, useState, useEffect, useRef } from 'react';
import {
    Body,
    BodyRows,
    Cell,
    ColGroup,
    Details,
    GroupHeader,
    Header,
    HeaderRows,
    Row,
    Th,
    Toggle,
} from './components';

// ⬅️ re-export: Details 모듈의 훅/프로바이더를 Table 모듈에서 다시 내보내기
export {
    RowDetailsProvider,
    useDetailsRenderer,
    useRowDetails,
    type DetailsRenderer,
} from './components/Details/Details';

/* =========================
   Types
   ========================= */

export interface ColumnType<T> {
    key: string;
    label?: string;
    render: (item: T, index: number) => React.ReactElement;
    header: (key: string, data: T[]) => React.ReactElement;
    width?: number | string;
}

export type Column<T> = {
    key: string;
    label?: string;
    header: (key: string, data: T[]) => React.ReactElement;
    render?: (item: T, index: number) => React.ReactElement;
    width?: number | string;
    children?: ColumnType<T>[];
};

export type UseTableParams<T> = {
    columns: Column<T>[];
    data: T[];
    defaultColWidth?: number;
    containerPaddingPx?: number;
};

export type UseTableResult<T> = {
    groupColumnRow: {
        key: string;
        columns: {
            key: string;
            colSpan: number;
            render: (key: string, data?: T[]) => React.ReactElement;
        }[];
    };
    columnRow: {
        key: string;
        columns: {
            key: string;
            render: (key: string, data?: T[]) => React.ReactElement;
            width: number;
        }[];
    };
    rows: {
        key: string;
        item: T;
        cells: {
            key: string;
            render: (item: T, rowIndex: number) => React.ReactElement;
        }[];
    }[];
    getColStyle: (colIndex: number) => React.CSSProperties;
    resizeColumn: (colIndex: number, width: number) => void;
};

/* =========================
   Helpers
   ========================= */

const MIN_COL_WIDTH = 80;

const toNumberPx = (w: number | string | undefined, fallback: number, containerW: number) => {
    if (typeof w === 'number') return w;

    if (typeof w === 'string') {
        const s = w.trim();

        if (s.endsWith('%')) {
            const p = parseFloat(s.slice(0, -1));
            if (!Number.isNaN(p) && containerW > 0) {
                return Math.max(0, (containerW * p) / 100);
            }
            return fallback;
        }

        const px = parseFloat(s);
        if (!Number.isNaN(px)) return px;
    }

    return fallback;
};

const measureParentWidth = (el: HTMLTableElement | null) => {
    if (!el || !el.parentElement) return 0;
    const parent = el.parentElement;

    const cs = getComputedStyle(parent);
    const padL = parseFloat(cs.paddingLeft || '0');
    const padR = parseFloat(cs.paddingRight || '0');

    const contentBoxWidth = parent.clientWidth - padL - padR;
    return Math.max(0, contentBoxWidth);
};

/* =========================
   Hook: useTable
   ========================= */

export const useTable = <T,>({
    columns,
    data,
    defaultColWidth = 200,
    containerPaddingPx = 0,
    containerWidth,
}: UseTableParams<T> & { containerWidth: number }): UseTableResult<T> => {
    const leafColumns = useMemo(
        () =>
            columns.flatMap((col) => {
                if (col.children && col.children.length > 0) return col.children;

                const render =
                    col.render ??
                    (((_it: T, _idx: number) => null) as unknown as (item: T, index: number) => React.ReactElement);

                return [
                    {
                        key: col.key,
                        label: col.label,
                        render,
                        header: col.header,
                        width: col.width,
                    } as ColumnType<T>,
                ];
            }),
        [columns]
    );

    const innerWidth = Math.max(0, containerWidth - containerPaddingPx);

    const baseLeafWidthsPx = useMemo(
        () => leafColumns.map((c) => toNumberPx(c.width, defaultColWidth, innerWidth)),
        [leafColumns, defaultColWidth, innerWidth]
    );

    const [columnWidths, setColumnWidths] = useState<number[]>([]);

    useEffect(() => {
        setColumnWidths((prev) => {
            if (prev.length === leafColumns.length) {
                return prev;
            }

            const next = leafColumns.map((_col, idx) => {
                if (idx < prev.length && typeof prev[idx] === 'number' && prev[idx] > 0) {
                    return prev[idx];
                }

                const base = baseLeafWidthsPx[idx];
                return Number.isFinite(base) ? base : defaultColWidth;
            });

            return next;
        });
    }, [leafColumns, baseLeafWidthsPx, defaultColWidth]);

    const resizeColumn = (colIndex: number, width: number) => {
        setColumnWidths((prev) => {
            if (colIndex < 0 || colIndex >= leafColumns.length) return prev;

            const next = [...prev];
            const clamped = Math.max(MIN_COL_WIDTH, width);
            next[colIndex] = clamped;
            return next;
        });
    };

    const columnRow = useMemo(
        () => ({
            key: 'column',
            columns: leafColumns.map((c, idx) => {
                const stored = columnWidths[idx];
                const base = baseLeafWidthsPx[idx] ?? defaultColWidth;
                const width = typeof stored === 'number' && stored > 0 ? stored : base;

                return {
                    key: c.key,
                    render: () => c.header(c.key, data),
                    width: Math.round(width),
                };
            }),
        }),
        [leafColumns, columnWidths, baseLeafWidthsPx, data, defaultColWidth]
    );

    const groupColumnRow = useMemo(() => {
        const leafKeys = new Set(leafColumns.map((c) => c.key));

        const calcSpan = (col: Column<T>) => {
            if (col.children && col.children.length > 0) {
                const span = col.children.filter((ch) => leafKeys.has(ch.key)).length;
                return span;
            }
            return leafKeys.has(col.key) ? 1 : 0;
        };

        return {
            key: 'group-column',
            columns: columns
                .map((col) => ({
                    key: col.key,
                    colSpan: calcSpan(col),
                    render: (key: string) => col.header(key, data),
                }))
                .filter((c) => c.colSpan > 0),
        };
    }, [columns, data, leafColumns]);

    const rows = useMemo(
        () =>
            data.map((item, rowIndex) => ({
                key: `row-${rowIndex}`,
                item,
                cells: leafColumns.map((leaf) => ({
                    key: leaf.key,
                    render: (it: T, idx: number) => leaf.render(it, idx),
                })),
            })),
        [data, leafColumns]
    );

    const getColStyle = (colIndex: number): React.CSSProperties => {
        const w = columnRow.columns[colIndex]?.width ?? defaultColWidth;
        return { width: `${w}px` };
    };

    return { groupColumnRow, columnRow, rows, getColStyle, resizeColumn };
};

/* =========================
   Table Context
   ========================= */

export type TableContextValue<T> = { state: UseTableResult<T>; data: T[] };
type InternalTableContextValue = TableContextValue<unknown>;
const TableContext = createContext<InternalTableContextValue | undefined>(undefined);

export const useTableContext = <T,>(): { state: UseTableResult<T>; data: T[] } => {
    const ctx = useContext(TableContext);
    if (!ctx) throw new Error('Table components must be used inside <Table>');
    return ctx as TableContextValue<T>;
};

/* =========================
   TableInner
   ========================= */

const TableInner = <T,>({
    columns,
    data,
    defaultColWidth = 200,
    containerPaddingPx = 0,
    style,
    ...rest
}: UseTableParams<T> & React.HTMLAttributes<HTMLTableElement>) => {
    const ref = useRef<HTMLTableElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
        const el = ref.current;
        const parent = el?.parentElement ?? null;

        const update = () => {
            setContainerWidth(measureParentWidth(el));
        };

        update();

        if (!parent) return;

        const ro = new ResizeObserver(update);
        ro.observe(parent);

        return () => {
            ro.disconnect();
        };
    }, []);

    const state = useTable<T>({
        columns,
        data,
        defaultColWidth,
        containerPaddingPx,
        containerWidth,
    });

    const value: TableContextValue<T> = { state, data };

    return (
        <TableContext.Provider value={value as InternalTableContextValue}>
            <table
                {...rest}
                ref={ref}
                style={{
                    tableLayout: 'fixed',
                    width: 'max-content', // ✅ 여기! 100% → auto 로 변경
                    ...style,
                }}
            />
        </TableContext.Provider>
    );
};

/* =========================
   합성 파츠 바인딩
   ========================= */

type TableStatics = {
    Body: typeof Body;
    BodyRows: typeof BodyRows;
    Cell: typeof Cell;
    ColGroup: typeof ColGroup;
    GroupHeader: typeof GroupHeader;
    Header: typeof Header;
    HeaderRows: typeof HeaderRows;
    Row: typeof Row;
    Details: typeof Details;
    Toggle: typeof Toggle;
    Th: typeof Th;
};

const Table = TableInner as typeof TableInner & TableStatics;

Table.Body = Body;
Table.BodyRows = BodyRows;
Table.Cell = Cell;
Table.ColGroup = ColGroup;
Table.GroupHeader = GroupHeader;
Table.Header = Header;
Table.HeaderRows = HeaderRows;
Table.Row = Row;
Table.Details = Details;
Table.Toggle = Toggle;
Table.Th = Th;

export default Table;
