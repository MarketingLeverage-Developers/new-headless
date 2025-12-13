import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

type PersistedTableState = {
    columnWidths: Record<string, number>;
    columnOrder: string[];
    visibleColumnKeys: string[];
    knownColumnKeys: string[];
};

const uniq = (arr: string[]) => Array.from(new Set(arr));
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
                if (typeof v === 'number' && Number.isFinite(v)) {
                    columnWidths[String(k)] = v;
                }
            });
        }

        const columnOrder = uniq(normalizeStringArray(obj.columnOrder));
        const visibleColumnKeys = uniq(normalizeStringArray(obj.visibleColumnKeys));

        const legacyKnown = uniq([
            ...visibleColumnKeys,
            ...columnOrder,
            ...Object.keys(columnWidths).map((k) => String(k)),
        ]);

        const knownColumnKeys = (() => {
            const rawKnown = (obj as any).knownColumnKeys;
            const parsedKnown = uniq(normalizeStringArray(rawKnown));
            return parsedKnown.length > 0 ? parsedKnown : legacyKnown;
        })();

        return {
            columnWidths,
            columnOrder,
            visibleColumnKeys,
            knownColumnKeys,
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

const mergeOrderByLeafKeys = (prevOrder: string[], leafKeys: string[]) => {
    const prev = uniq(prevOrder.map(String));
    if (leafKeys.length === 0) return prev;

    const next = [...prev];

    const findInsertIndex = (key: string) => {
        const idxInLeaf = leafKeys.indexOf(key);

        for (let i = idxInLeaf - 1; i >= 0; i -= 1) {
            const leftKey = leafKeys[i];
            const pos = next.indexOf(leftKey);
            if (pos !== -1) return pos + 1;
        }

        for (let i = idxInLeaf + 1; i < leafKeys.length; i += 1) {
            const rightKey = leafKeys[i];
            const pos = next.indexOf(rightKey);
            if (pos !== -1) return pos;
        }

        return next.length;
    };

    leafKeys.forEach((k) => {
        if (next.includes(k)) return;
        const at = findInsertIndex(k);
        next.splice(at, 0, k);
    });

    return uniq(next);
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
    const leafColumns = useMemo(
        () =>
            columns.flatMap((col) => {
                if (col.children && col.children.length > 0) {
                    return col.children.map((ch) => ({
                        ...ch,
                        key: String(ch.key),
                    }));
                }

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

    const leafKeys = useMemo(() => uniq(leafColumns.map((c) => c.key)), [leafColumns]);
    const leafKeySet = useMemo(() => new Set(leafKeys), [leafKeys]);

    const innerWidth = Math.max(0, containerWidth - containerPaddingPx);

    const baseLeafWidthByKey = useMemo(() => {
        const map = new Map<string, number>();
        leafColumns.forEach((c) => {
            if (map.has(c.key)) return;
            map.set(c.key, toNumberPx(c.width, defaultColWidth, innerWidth));
        });
        return map;
    }, [leafColumns, defaultColWidth, innerWidth]);

    const [persisted, setPersisted] = useState<PersistedTableState | null>(() => loadPersistedTableState(storageKey));

    const skipNextSaveRef = useRef(false);
    useEffect(() => {
        if (!storageKey) {
            setPersisted(null);
            return;
        }
        skipNextSaveRef.current = true;
        setPersisted(loadPersistedTableState(storageKey));
    }, [storageKey]);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => persisted?.columnWidths ?? {});
    const [columnOrder, setColumnOrder] = useState<string[]>(() => {
        if (persisted?.columnOrder && persisted.columnOrder.length > 0) return persisted.columnOrder;
        return leafKeys;
    });

    const [visibleColumnKeysDesired, setVisibleColumnKeysDesired] = useState<string[]>(() => {
        if (persisted?.visibleColumnKeys && persisted.visibleColumnKeys.length > 0) return persisted.visibleColumnKeys;
        return leafKeys;
    });

    const [knownColumnKeys, setKnownColumnKeys] = useState<string[]>(() => persisted?.knownColumnKeys ?? []);
    const knownSetRef = useRef<Set<string>>(new Set(persisted?.knownColumnKeys ?? []));
    useEffect(() => {
        knownSetRef.current = new Set(knownColumnKeys);
    }, [knownColumnKeys]);

    // ✅ “즉시 저장”을 위해 최신 상태를 ref로 들고있기
    const stateRef = useRef<PersistedTableState>({
        columnWidths,
        columnOrder,
        visibleColumnKeys: visibleColumnKeysDesired,
        knownColumnKeys,
    });

    useEffect(() => {
        stateRef.current = {
            columnWidths,
            columnOrder,
            visibleColumnKeys: visibleColumnKeysDesired,
            knownColumnKeys,
        };
    }, [columnWidths, columnOrder, visibleColumnKeysDesired, knownColumnKeys]);

    const persistNow = useCallback(() => {
        if (!storageKey) return;
        if (skipNextSaveRef.current) return;

        const s = stateRef.current;
        savePersistedTableState(storageKey, {
            columnWidths: s.columnWidths,
            columnOrder: uniq(s.columnOrder),
            visibleColumnKeys: uniq(s.visibleColumnKeys),
            knownColumnKeys: uniq(s.knownColumnKeys),
        });
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey) return;

        const nextWidths = persisted?.columnWidths ?? {};
        const nextOrder = persisted?.columnOrder && persisted.columnOrder.length > 0 ? persisted.columnOrder : leafKeys;
        const nextVisible =
            persisted?.visibleColumnKeys && persisted.visibleColumnKeys.length > 0
                ? persisted.visibleColumnKeys
                : leafKeys;
        const nextKnown = persisted?.knownColumnKeys ?? [];

        setColumnWidths(nextWidths);
        setColumnOrder(uniq(nextOrder));
        setVisibleColumnKeysDesired(uniq(nextVisible));
        setKnownColumnKeys(uniq(nextKnown));
        knownSetRef.current = new Set(uniq(nextKnown));

        // ✅ 로드 직후에는 저장 막기 해제
        queueMicrotask(() => {
            skipNextSaveRef.current = false;
        });
    }, [persisted, storageKey, leafKeys]);

    const visibleColumnKeys = useMemo(
        () => uniq(visibleColumnKeysDesired.filter((k) => leafKeySet.has(k))),
        [visibleColumnKeysDesired, leafKeySet]
    );

    const setVisibleColumnKeys = useCallback(
        (nextVisibleKeysOnCurrentLeaf: string[]) => {
            const nextKeys = uniq(nextVisibleKeysOnCurrentLeaf.map(String));

            setVisibleColumnKeysDesired((prevDesired) => {
                const preserved = prevDesired.filter((k) => !leafKeySet.has(k));
                const next = uniq([...preserved, ...nextKeys]);

                // ✅ 즉시 저장
                stateRef.current = {
                    ...stateRef.current,
                    visibleColumnKeys: next,
                };
                persistNow();

                return next;
            });
        },
        [leafKeySet, persistNow]
    );

    useEffect(() => {
        if (leafKeys.length === 0) return;

        const knownSet = knownSetRef.current;
        const newKeys = leafKeys.filter((k) => !knownSet.has(k));

        const nextKnown = new Set(knownSet);
        leafKeys.forEach((k) => nextKnown.add(k));
        knownSetRef.current = nextKnown;
        setKnownColumnKeys(Array.from(nextKnown));

        // width sync
        setColumnWidths((prev) => {
            const next: Record<string, number> = { ...prev };

            leafKeys.forEach((k) => {
                const existing = next[k];
                if (typeof existing !== 'number' || existing <= 0) {
                    const base = baseLeafWidthByKey.get(k) ?? defaultColWidth;
                    next[k] = Math.max(MIN_COL_WIDTH, Number.isFinite(base) ? base : defaultColWidth);
                }
            });

            return next;
        });

        // order sync
        setColumnOrder((prev) => mergeOrderByLeafKeys(prev, leafKeys));

        // 신규 컬럼 자동 ON
        setVisibleColumnKeysDesired((prevDesired) => {
            if (!prevDesired || prevDesired.length === 0) return leafKeys;
            if (newKeys.length > 0) return uniq([...prevDesired, ...newKeys]);
            return prevDesired;
        });
    }, [leafKeys, baseLeafWidthByKey, defaultColWidth]);

    const resizeColumn = useCallback(
        (colKey: string, width: number) => {
            const key = String(colKey);

            setColumnWidths((prev) => {
                const next = { ...prev };
                next[key] = Math.max(MIN_COL_WIDTH, width);

                // ✅ 즉시 저장
                stateRef.current = {
                    ...stateRef.current,
                    columnWidths: next,
                };
                persistNow();

                return next;
            });
        },
        [persistNow]
    );

    const reorderColumn = useCallback(
        (fromKey: string, toKey: string) => {
            const from = String(fromKey);
            const to = String(toKey);

            setColumnOrder((prev) => {
                if (from === to) return prev;

                const prevUnique = uniq(prev);
                const fromIndex = prevUnique.indexOf(from);
                const toIndex = prevUnique.indexOf(to);

                if (fromIndex === -1 || toIndex === -1) return prevUnique;

                const next = [...prevUnique];
                const [moved] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, moved);

                // ✅ 즉시 저장
                stateRef.current = {
                    ...stateRef.current,
                    columnOrder: next,
                };
                persistNow();

                return next;
            });
        },
        [persistNow]
    );

    const orderedLeafColumns = useMemo(() => {
        const colMap = new Map<string, ColumnType<T>>();
        leafColumns.forEach((c) => {
            if (!colMap.has(c.key)) colMap.set(c.key, c);
        });

        const orderUnique = uniq(columnOrder);
        const result: ColumnType<T>[] = [];

        orderUnique.forEach((k) => {
            const c = colMap.get(k);
            if (c) result.push(c);
        });

        leafKeys.forEach((k) => {
            if (orderUnique.includes(k)) return;
            const c = colMap.get(k);
            if (c) result.push(c);
        });

        return result;
    }, [leafColumns, leafKeys, columnOrder]);

    const columnRow = useMemo(() => {
        const headerColumns = orderedLeafColumns.reduce<
            { key: string; render: (key: string, data?: T[]) => React.ReactElement; width: number }[]
        >((acc, col) => {
            if (!visibleColumnKeys.includes(col.key)) return acc;

            const base = baseLeafWidthByKey.get(col.key) ?? defaultColWidth;
            const stored = columnWidths[col.key];
            const width = typeof stored === 'number' && stored > 0 ? stored : base;

            acc.push({
                key: col.key,
                render: () => col.header(col.key, data),
                width: Math.round(Math.max(MIN_COL_WIDTH, width)),
            });

            return acc;
        }, []);

        return { key: 'column', columns: headerColumns };
    }, [orderedLeafColumns, visibleColumnKeys, baseLeafWidthByKey, defaultColWidth, columnWidths, data]);

    const groupColumnRow = useMemo(() => {
        const visibleKeysSet = new Set(visibleColumnKeys);
        const orderedLeafKeySet = new Set(orderedLeafColumns.map((c) => c.key));

        const calcSpan = (col: Column<T>) => {
            if (col.children && col.children.length > 0) {
                return col.children.filter((ch) => {
                    const k = String(ch.key);
                    return orderedLeafKeySet.has(k) && visibleKeysSet.has(k);
                }).length;
            }

            const k = String(col.key);
            return orderedLeafKeySet.has(k) && visibleKeysSet.has(k) ? 1 : 0;
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

    return {
        groupColumnRow,
        columnRow,
        rows,
        getColStyle,
        resizeColumn,
        columnOrder: uniq(columnOrder),
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
