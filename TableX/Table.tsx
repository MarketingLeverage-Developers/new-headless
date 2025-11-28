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
import ColumnSelectBox from './components/ColumnSelectBox/ColumnSelectBox';
import View from './components/View/View';

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

    // 컬럼 순서 + 재배열
    columnOrder: string[];
    reorderColumn: (fromKey: string, toKey: string) => void;

    // 컬럼 노출 상태
    visibleColumnKeys: string[];
    setVisibleColumnKeys: (keys: string[]) => void;
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
    // leaf 컬럼으로 평탄화
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

    // 컬럼 순서 상태
    const [columnOrder, setColumnOrder] = useState<string[]>(() => leafColumns.map((c) => c.key));

    // 컬럼 노출 상태 (기본: 모든 컬럼 ON)
    const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => leafColumns.map((c) => c.key));

    // leafColumns 변경 시, width / order / visible 동기화
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

        // 순서 동기화
        setColumnOrder((prev) => {
            const leafKeys = leafColumns.map((c) => c.key);
            const next: string[] = [];

            prev.forEach((key) => {
                if (leafKeys.includes(key)) next.push(key);
            });

            leafKeys.forEach((key) => {
                if (!next.includes(key)) next.push(key);
            });

            return next;
        });

        // 노출 상태 동기화 (기존에 보이던 컬럼은 유지, 새 컬럼은 자동 ON)
        setVisibleColumnKeys((prev) => {
            const leafKeys = leafColumns.map((c) => c.key);
            const next: string[] = [];

            prev.forEach((key) => {
                if (leafKeys.includes(key)) next.push(key);
            });

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

    // 순서 기준으로 leaf 컬럼 정렬
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

        // 혹시 빠진 컬럼 있으면 뒤에 추가
        leafColumns.forEach((c) => {
            if (!columnOrder.includes(c.key)) {
                result.push(c);
            }
        });

        return result;
    }, [leafColumns, columnOrder]);

    // 1단 헤더: "보이는" 컬럼만
    const columnRow = useMemo(() => {
        const cols = orderedLeafColumns;

        const headerColumns = cols.reduce<
            {
                key: string;
                render: (key: string, data?: T[]) => React.ReactElement;
                width: number;
            }[]
        >((acc, c, idx) => {
            if (!visibleColumnKeys.includes(c.key)) return acc;

            const stored = columnWidths[idx];
            const base = baseLeafWidthsPx[idx] ?? defaultColWidth;
            const width = typeof stored === 'number' && stored > 0 ? stored : base;

            acc.push({
                key: c.key,
                render: () => c.header(c.key, data),
                width: Math.round(width),
            });

            return acc;
        }, []);

        return {
            key: 'column',
            columns: headerColumns,
        };
    }, [orderedLeafColumns, columnWidths, baseLeafWidthsPx, data, defaultColWidth, visibleColumnKeys]);

    // 그룹 헤더: child 기준 colSpan, hidden 컬럼은 제외
    const groupColumnRow = useMemo(() => {
        const visibleKeysSet = new Set(visibleColumnKeys);
        const leafKeys = new Set(orderedLeafColumns.map((c) => c.key));

        const calcSpan = (col: Column<T>) => {
            if (col.children && col.children.length > 0) {
                const span = col.children.filter((ch) => leafKeys.has(ch.key) && visibleKeysSet.has(ch.key)).length;
                return span;
            }

            return leafKeys.has(col.key) && visibleKeysSet.has(col.key) ? 1 : 0;
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
    }, [columns, data, orderedLeafColumns, visibleColumnKeys]);

    // 바디 행: "보이는" 컬럼만 셀로 구성
    const rows = useMemo(
        () =>
            data.map((item, rowIndex) => ({
                key: `row-${rowIndex}`,
                item,
                cells: orderedLeafColumns
                    .filter((leaf) => visibleColumnKeys.includes(leaf.key))
                    .map((leaf) => ({
                        key: leaf.key,
                        render: (it: T, idx: number) => leaf.render(it, idx),
                    })),
            })),
        [data, orderedLeafColumns, visibleColumnKeys]
    );

    const getColStyle = (colIndex: number): React.CSSProperties => {
        const w = columnRow.columns[colIndex]?.width ?? defaultColWidth;
        return { width: `${w}px` };
    };

    // 드래그앤드롭용 재배열
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
        visibleColumnKeys,
        setVisibleColumnKeys,
    };
};

/* =========================
   Table Context
   ========================= */

export type TableContextValue<T> = { state: UseTableResult<T>; data: T[]; columns: Column<T>[] };
type InternalTableContextValue = TableContextValue<unknown>;
const TableContext = createContext<InternalTableContextValue | undefined>(undefined);

export const useTableContext = <T,>(): { state: UseTableResult<T>; data: T[]; columns: Column<T>[] } => {
    const ctx = useContext(TableContext);
    if (!ctx) throw new Error('Table components must be used inside <Table>');
    return ctx as TableContextValue<T>;
};

/* =========================
   Table Provider (Wrapper)
   ========================= */

const TableInner = <T,>({
    columns,
    data,
    defaultColWidth = 200,
    containerPaddingPx = 0,
    style,
    children,
    ...rest
}: UseTableParams<T> & React.HTMLAttributes<HTMLDivElement>) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;

        const update = () => {
            setContainerWidth(el.clientWidth);
        };

        update();

        const ro = new ResizeObserver(update);
        ro.observe(el);

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

    const value: TableContextValue<T> = { state, data, columns };

    return (
        <TableContext.Provider value={value as InternalTableContextValue}>
            <div
                {...rest}
                ref={wrapperRef}
                style={{
                    width: '100%',
                    ...style,
                }}
            >
                {children}
            </div>
        </TableContext.Provider>
    );
};

/* =========================
   Table View (<table> DOM)
   ========================= */

const TableView = <T,>(props: React.TableHTMLAttributes<HTMLTableElement>) => {
    const { state } = useTableContext<T>();

    const totalTableWidth = state.columnRow.columns.reduce((sum, col) => sum + col.width, 0);

    return (
        <table
            {...props}
            style={{
                tableLayout: 'fixed',
                width: `${totalTableWidth}px`,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                ...props.style,
            }}
        />
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
    ColumnSelectBox: typeof ColumnSelectBox;
    View: typeof View;
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
Table.ColumnSelectBox = ColumnSelectBox;
Table.View = View;

export default Table;
