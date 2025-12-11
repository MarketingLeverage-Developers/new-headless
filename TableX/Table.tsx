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

    // 각 row의 key를 item 특정 필드 값으로 사용하기 위한 옵션
    // 예: rowKeyField="id" -> item["id"]가 key로 사용됨 (없으면 rowIndex로 fallback)
    rowKeyField?: string;

    // 컬럼 리사이징 및 드래그앤드롭 비활성화 (모바일 등에서 사용)
    disableColumnInteractions?: boolean;

    // 이 테이블 설정을 localStorage 에 영구 저장하기 위한 키
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

    // ✅ 이제 colIndex가 아니라 colKey 기준
    getColStyle: (colKey: string) => React.CSSProperties;
    resizeColumn: (colKey: string, width: number) => void;

    // 컬럼 순서 + 재배열
    columnOrder: string[];
    reorderColumn: (fromKey: string, toKey: string) => void;

    // 컬럼 노출 상태
    visibleColumnKeys: string[];
    setVisibleColumnKeys: (keys: string[]) => void;

    // 컬럼 상호작용 비활성화 플래그
    disableColumnInteractions: boolean;
};

/* =========================
   Helpers
   ========================= */

const MIN_COL_WIDTH = 80;

// localStorage 에 저장되는 테이블 상태
type PersistedTableState = {
    columnWidths: Record<string, number>;
    columnOrder: string[];
    visibleColumnKeys: string[];
};

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
                if (typeof v === 'number') {
                    columnWidths[k] = v;
                }
            });
        }

        const columnOrder = Array.isArray(obj.columnOrder) ? obj.columnOrder.map((k) => String(k)) : [];
        const visibleColumnKeys = Array.isArray(obj.visibleColumnKeys)
            ? obj.visibleColumnKeys.map((k) => String(k))
            : [];

        return {
            columnWidths,
            columnOrder,
            visibleColumnKeys,
        };
    } catch {
        return null;
    }
};

const savePersistedTableState = (storageKey: string, state: PersistedTableState) => {
    if (typeof window === 'undefined') return;

    try {
        const payload: PersistedTableState = {
            columnWidths: state.columnWidths,
            columnOrder: state.columnOrder,
            visibleColumnKeys: state.visibleColumnKeys,
        };

        window.localStorage.setItem(storageKey, JSON.stringify(payload));
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
        if (persisted?.columnOrder && persisted.columnOrder.length > 0) {
            return persisted.columnOrder;
        }
        return leafColumns.map((c) => c.key);
    });

    const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => {
        if (persisted?.visibleColumnKeys && persisted.visibleColumnKeys.length > 0) {
            return persisted.visibleColumnKeys;
        }
        return leafColumns.map((c) => c.key);
    });

    // leafColumns 변경 시 width / order / visible 동기화
    useEffect(() => {
        // width: 새로 생긴 컬럼만 기본값 채우고, 사라진 컬럼은 정리
        setColumnWidths((prev) => {
            const next: Record<string, number> = { ...prev };
            const leafKeySet = new Set(leafColumns.map((c) => c.key));

            leafColumns.forEach((col, idx) => {
                const key = col.key;
                if (typeof next[key] !== 'number' || next[key] <= 0) {
                    const base = baseLeafWidthsPx[idx];
                    const w = Number.isFinite(base) ? base : defaultColWidth;
                    next[key] = w;
                }
            });

            Object.keys(next).forEach((key) => {
                if (!leafKeySet.has(key)) {
                    delete next[key];
                }
            });

            return next;
        });

        // 순서 동기화 (기존 순서 유지 + 새 컬럼 뒤에 추가)
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

        // 노출 상태 동기화
        // - 기존 visible 에 있던 컬럼 중, 여전히 존재하는 것만 유지
        // - prev가 완전히 비어 있는 경우(진짜 초기)에는 전체 ON
        setVisibleColumnKeys((prev) => {
            const leafKeys = leafColumns.map((c) => c.key);
            const leafKeySet = new Set(leafKeys);
            const filtered = prev.filter((key) => leafKeySet.has(key));

            if (filtered.length === 0) {
                return leafKeys;
            }

            return filtered;
        });
    }, [leafColumns, baseLeafWidthsPx, defaultColWidth]);

    // 상태 변경시 localStorage 저장
    useEffect(() => {
        if (!storageKey) return;
        if (!leafColumns.length) return;

        savePersistedTableState(storageKey, {
            columnWidths,
            columnOrder,
            visibleColumnKeys,
        });
    }, [storageKey, columnWidths, columnOrder, visibleColumnKeys, leafColumns.length]);

    const resizeColumn = (colKey: string, width: number) => {
        setColumnWidths((prev) => {
            const next = { ...prev };
            const clamped = Math.max(MIN_COL_WIDTH, width);
            next[colKey] = clamped;
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
        const headerColumns = orderedLeafColumns.reduce<
            {
                key: string;
                render: (key: string, data?: T[]) => React.ReactElement;
                width: number;
            }[]
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

        return {
            key: 'column',
            columns: headerColumns,
        };
    }, [orderedLeafColumns, visibleColumnKeys, columnWidths, leafIndexByKey, baseLeafWidthsPx, data, defaultColWidth]);

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
        rowKeyField,
        disableColumnInteractions,
        storageKey,
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
