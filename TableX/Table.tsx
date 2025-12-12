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

    rowKeyField?: string;

    disableColumnInteractions?: boolean;

    storageKey?: string;
};

export type UseTableResult<T> = {
    groupColumnRow: {
        key: string;
        columns: {
            key: string;
            colSpan: number;
            render: (key: string, data: T[]) => React.ReactElement;
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

    getColStyle: (colKey: string) => React.CSSProperties;
    resizeColumn: (colKey: string, width: number) => void;

    columnOrder: string[];
    reorderColumn: (fromKey: string, toKey: string) => void;

    visibleColumnKeys: string[];
    setVisibleColumnKeys: (keys: string[]) => void;

    disableColumnInteractions: boolean;
};

/* =========================
   Helpers
   ========================= */

const MIN_COL_WIDTH = 80;

// ✅ localStorage 에 저장되는 테이블 상태
type PersistedTableState = {
    columnWidths: Record<string, number>;
    columnOrder: string[];
    visibleColumnKeys: string[];

    // ✅ 추가: “그 시점에 존재했던 컬럼 keys”
    // 이걸로 “새로 생긴 컬럼”과 “유저가 숨긴 컬럼”을 구분
    knownColumnKeys: string[];
};

const normalizeStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

const loadPersistedTableState = (storageKey?: string): PersistedTableState | null => {
    if (!storageKey) return null;
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;

        const obj = parsed as Partial<PersistedTableState>;

        const columnWidths: Record<string, number> = {};
        if (obj.columnWidths && typeof obj.columnWidths === 'object' && !Array.isArray(obj.columnWidths)) {
            Object.entries(obj.columnWidths).forEach(([k, v]) => {
                if (typeof v === 'number') columnWidths[String(k)] = v;
            });
        }

        const columnOrder = normalizeStringArray(obj.columnOrder);
        const visibleColumnKeys = normalizeStringArray(obj.visibleColumnKeys);

        // ✅ 과거 버전(knownColumnKeys 없음) 호환:
        //    known이 없으면 “이미 알고 있던 컬럼”을 추정해서 만든다.
        //    (visible/widths/order에 등장한 키들은 과거에도 존재했던 키로 간주)
        const legacyKnown = Array.from(
            new Set<string>([...visibleColumnKeys, ...columnOrder, ...Object.keys(columnWidths).map((k) => String(k))])
        );

        const knownColumnKeysRaw = (obj as any).knownColumnKeys;
        const knownColumnKeys = normalizeStringArray(knownColumnKeysRaw);
        const finalKnown = knownColumnKeys.length > 0 ? knownColumnKeys : legacyKnown;

        return {
            columnWidths,
            columnOrder,
            visibleColumnKeys,
            knownColumnKeys: finalKnown,
        };
    } catch {
        return null;
    }
};

const savePersistedTableState = (storageKey: string, state: PersistedTableState) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
        // ignore
    }
};

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
    rowKeyField,
    disableColumnInteractions = false,
    storageKey,
}: UseTableParams<T> & { containerWidth: number }): UseTableResult<T> => {
    // leaf 컬럼 평탄화
    const leafColumns = useMemo(
        () =>
            columns.flatMap((col) => {
                if (col.children && col.children.length > 0) return col.children;

                const render =
                    col.render ??
                    (((_it: T, _idx: number) => null) as unknown as (item: T, index: number) => React.ReactElement);

                return [
                    {
                        key: String(col.key),
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

    const leafIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        leafColumns.forEach((col, idx) => {
            map.set(col.key, idx);
        });
        return map;
    }, [leafColumns]);

    // 최초 1회 localStorage 로딩
    const persistedRef = useRef<PersistedTableState | null | undefined>(undefined);
    if (persistedRef.current === undefined) {
        persistedRef.current = loadPersistedTableState(storageKey);
    }
    const persisted = persistedRef.current;

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => persisted?.columnWidths ?? {});

    const [columnOrder, setColumnOrder] = useState<string[]>(() => {
        if (persisted?.columnOrder && persisted.columnOrder.length > 0) return persisted.columnOrder;
        return leafColumns.map((c) => c.key);
    });

    const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => {
        if (persisted?.visibleColumnKeys && persisted.visibleColumnKeys.length > 0) return persisted.visibleColumnKeys;
        return leafColumns.map((c) => c.key);
    });

    // leafColumns 변경 시 width / order / visible 동기화
    useEffect(() => {
        const leafKeys = leafColumns.map((c) => c.key);
        const leafKeySet = new Set(leafKeys);

        // width sync
        setColumnWidths((prev) => {
            const next: Record<string, number> = { ...prev };

            leafColumns.forEach((col, idx) => {
                const key = col.key;
                if (typeof next[key] !== 'number' || next[key] <= 0) {
                    const base = baseLeafWidthsPx[idx];
                    next[key] = Number.isFinite(base) ? base : defaultColWidth;
                }
            });

            Object.keys(next).forEach((key) => {
                if (!leafKeySet.has(key)) delete next[key];
            });

            return next;
        });

        // order sync
        setColumnOrder((prev) => {
            const next: string[] = [];

            prev.forEach((key) => {
                if (leafKeySet.has(key)) next.push(key);
            });

            leafKeys.forEach((key) => {
                if (!next.includes(key)) next.push(key);
            });

            return next;
        });

        // ✅ visible sync (핵심 수정)
        // - 사라진 키 제거
        // - “진짜 새로 생긴 컬럼(known에 없던 키)”만 자동 ON
        // - known에 있었는데 visible에 없으면 → 유저가 숨긴 것이므로 그대로 유지
        setVisibleColumnKeys((prev) => {
            const prevFiltered = prev.filter((key) => leafKeySet.has(key));

            const known = new Set<string>(persisted?.knownColumnKeys ?? []);
            const next = [...prevFiltered];

            leafKeys.forEach((key) => {
                const isAlreadyVisible = next.includes(key);
                const isKnown = known.has(key);

                // ✅ known에 없던 키만 “신규 컬럼”으로 간주하고 자동 ON
                if (!isAlreadyVisible && !isKnown) {
                    next.push(key);
                }
            });

            // 완전 비어있으면(초기) 전체 ON
            if (next.length === 0) return leafKeys;

            return next;
        });
    }, [leafColumns, baseLeafWidthsPx, defaultColWidth, persisted?.knownColumnKeys]);

    // 상태 변경시 localStorage 저장
    useEffect(() => {
        if (!storageKey) return;
        if (!leafColumns.length) return;

        const leafKeys = leafColumns.map((c) => c.key);

        savePersistedTableState(storageKey, {
            columnWidths,
            columnOrder,
            visibleColumnKeys,
            // ✅ 현재 시점에 존재하는 컬럼 전체를 known으로 저장
            knownColumnKeys: leafKeys,
        });
    }, [storageKey, columnWidths, columnOrder, visibleColumnKeys, leafColumns]);

    const resizeColumn = (colKey: string, width: number) => {
        setColumnWidths((prev) => {
            const next = { ...prev };
            next[colKey] = Math.max(MIN_COL_WIDTH, width);
            return next;
        });
    };

    // order 기준 정렬
    const orderedLeafColumns = useMemo(() => {
        const map = new Map<string, ColumnType<T>>();
        leafColumns.forEach((c) => map.set(c.key, c));

        const result: ColumnType<T>[] = [];
        columnOrder.forEach((key) => {
            const col = map.get(key);
            if (col) result.push(col);
        });

        leafColumns.forEach((c) => {
            if (!columnOrder.includes(c.key)) result.push(c);
        });

        return result;
    }, [leafColumns, columnOrder]);

    // 1단 헤더: 보이는 컬럼만
    const columnRow = useMemo(() => {
        const headerColumns = orderedLeafColumns.reduce<
            { key: string; render: (key: string, data?: T[]) => React.ReactElement; width: number }[]
        >((acc, col) => {
            if (!visibleColumnKeys.includes(col.key)) return acc;

            const leafIdx = leafIndexByKey.get(col.key) ?? 0;
            const base = baseLeafWidthsPx[leafIdx] ?? defaultColWidth;
            const stored = columnWidths[col.key];
            const width = typeof stored === 'number' && stored > 0 ? stored : base;

            acc.push({
                key: col.key,
                render: () => col.header(col.key, data),
                width: Math.round(width),
            });

            return acc;
        }, []);

        return { key: 'column', columns: headerColumns };
    }, [orderedLeafColumns, visibleColumnKeys, columnWidths, leafIndexByKey, baseLeafWidthsPx, data, defaultColWidth]);

    // 그룹 헤더
    const groupColumnRow = useMemo(() => {
        const visibleKeysSet = new Set(visibleColumnKeys);
        const leafKeys = new Set(orderedLeafColumns.map((c) => c.key));

        const calcSpan = (col: Column<T>) => {
            if (col.children && col.children.length > 0) {
                return col.children.filter((ch) => leafKeys.has(ch.key) && visibleKeysSet.has(ch.key)).length;
            }
            return leafKeys.has(String(col.key)) && visibleKeysSet.has(String(col.key)) ? 1 : 0;
        };

        return {
            key: 'group-column',
            columns: columns
                .map((col) => ({
                    key: String(col.key),
                    colSpan: calcSpan(col),
                    render: (key: string) => col.header(key, data),
                }))
                .filter((c) => c.colSpan > 0),
        };
    }, [columns, data, orderedLeafColumns, visibleColumnKeys]);

    // rows
    const rows = useMemo(
        () =>
            data.map((item, rowIndex) => {
                const rawKey = rowKeyField ? (item as Record<string, unknown>)[rowKeyField] : undefined;
                const keyValue =
                    typeof rawKey === 'string' || typeof rawKey === 'number' ? String(rawKey) : `row-${rowIndex}`;

                return {
                    key: keyValue,
                    item,
                    cells: orderedLeafColumns
                        .filter((leaf) => visibleColumnKeys.includes(leaf.key))
                        .map((leaf) => ({
                            key: leaf.key,
                            render: (it: T, idx: number) => leaf.render(it, idx),
                        })),
                };
            }),
        [data, orderedLeafColumns, visibleColumnKeys, rowKeyField]
    );

    const getColStyle = (colKey: string): React.CSSProperties => {
        const col = columnRow.columns.find((c) => c.key === colKey);
        const w = col?.width ?? defaultColWidth;
        return { width: `${w}px` };
    };

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
        disableColumnInteractions,
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
    rowKeyField,
    disableColumnInteractions = false,
    storageKey,
    ...rest
}: UseTableParams<T> & React.HTMLAttributes<HTMLDivElement>) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;

        const update = () => setContainerWidth(el.clientWidth);

        update();

        const ro = new ResizeObserver(update);
        ro.observe(el);

        return () => ro.disconnect();
    }, []);

    const state = useTable<T>({
        columns,
        data,
        defaultColWidth,
        containerPaddingPx,
        containerWidth,
        rowKeyField,
        disableColumnInteractions,
        storageKey,
    });

    const value: TableContextValue<T> = { state, data, columns };

    return (
        <TableContext.Provider value={value as InternalTableContextValue}>
            <div {...rest} ref={wrapperRef} style={{ width: '100%', ...style }}>
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
