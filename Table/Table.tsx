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

    // ✅ 추가: 컬럼 순서 + 재배열 API
    columnOrder: string[];
    reorderColumn: (fromKey: string, toKey: string) => void;
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
    // 1) 컬럼 정의를 leaf 컬럼으로 평탄화
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

    // ✅ 컬럼 순서 상태 (key 배열)
    const [columnOrder, setColumnOrder] = useState<string[]>(() => leafColumns.map((c) => c.key));

    // leafColumns 변경 시, columnWidths 길이 맞추기 + columnOrder도 동기화
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

        setColumnOrder((prev) => {
            const leafKeys = leafColumns.map((c) => c.key);
            const next: string[] = [];

            // 기존 순서 중 아직 존재하는 key 유지
            prev.forEach((key) => {
                if (leafKeys.includes(key)) next.push(key);
            });

            // 새로 생긴 컬럼 key는 뒤에 추가
            leafKeys.forEach((key) => {
                if (!next.includes(key)) next.push(key);
            });

            return next;
        });
    }, [leafColumns, baseLeafWidthsPx, defaultColWidth]);

    const resizeColumn = (colIndex: number, width: number) => {
        setColumnWidths((prev) => {
            if (colIndex < 0 || colIndex >= prev.length) return prev;

            const next = [...prev];
            const clamped = Math.max(MIN_COL_WIDTH, width);
            next[colIndex] = clamped;
            return next;
        });
    };

    // ✅ columnOrder 순서를 기준으로 leafColumns 정렬
    const orderedLeafColumns = useMemo(() => {
        const map = new Map<string, ColumnType<T>>();
        leafColumns.forEach((c) => {
            map.set(c.key, c);
        });

        const result: ColumnType<T>[] = [];
        columnOrder.forEach((key) => {
            const col = map.get(key);
            if (col) result.push(col);
        });

        // 혹시라도 columnOrder에 없는 컬럼이 있다면 뒤에 추가
        leafColumns.forEach((c) => {
            if (!columnOrder.includes(c.key)) {
                result.push(c);
            }
        });

        return result;
    }, [leafColumns, columnOrder]);

    // 1단 헤더용 데이터 구조
    const columnRow = useMemo(
        () => ({
            key: 'column',
            columns: orderedLeafColumns.map((c, idx) => {
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
        [orderedLeafColumns, columnWidths, baseLeafWidthsPx, data, defaultColWidth]
    );

    const groupColumnRow = useMemo(() => {
        const leafKeys = new Set(orderedLeafColumns.map((c) => c.key));

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
    }, [columns, data, orderedLeafColumns]);

    const rows = useMemo(
        () =>
            data.map((item, rowIndex) => ({
                key: `row-${rowIndex}`,
                item,
                cells: orderedLeafColumns.map((leaf) => ({
                    key: leaf.key,
                    render: (it: T, idx: number) => leaf.render(it, idx),
                })),
            })),
        [data, orderedLeafColumns]
    );

    const getColStyle = (colIndex: number): React.CSSProperties => {
        const w = columnRow.columns[colIndex]?.width ?? defaultColWidth;
        return { width: `${w}px` };
    };

    // ✅ 드래그앤드롭용 재배열 함수
    const reorderColumn = (fromKey: string, toKey: string) => {
        setColumnOrder((prev) => {
            if (fromKey === toKey) return prev;

            const fromIndex = prev.indexOf(fromKey);
            const toIndex = prev.indexOf(toKey);

            if (fromIndex === -1 || toIndex === -1) return prev;

            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);

            return next;
        });
    };

    return {
        groupColumnRow,
        columnRow,
        rows,
        getColStyle,
        resizeColumn,
        columnOrder,
        reorderColumn,
    };
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

    // 필요하다면 여기에서 totalTableWidth 계산해서 width px로 줄 수도 있음
    const totalTableWidth = state.columnRow.columns.reduce((sum, col) => sum + col.width, 0);

    return (
        <TableContext.Provider value={value as InternalTableContextValue}>
            <table
                {...rest}
                ref={ref}
                style={{
                    tableLayout: 'fixed',
                    width: `${totalTableWidth}px`,
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
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
