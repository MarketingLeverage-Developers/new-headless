import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Container } from './components/Container';
import { Header } from './components/Header';
import { Body } from './components/Body';
import { Ghost } from './components/Ghost';
import { ColumnVisibilityControl } from './components/ColumnVisibilityControl';
import RowToggle from './components/RowToggle';
import { ColumnSelectBoxPortal } from './components/ColumnSelectBoxPortal';

/* =========================
   Types
   ========================= */

export type CellRenderMeta<T> = {
    rowKey: string;
    ri: number;
    toggleRowExpanded: (rowKey: string) => void;
    isRowExpanded: (rowKey: string) => boolean;
};

export interface ColumnType<T> {
    key: string;
    label?: string;
    render: (item: T, index: number, meta: CellRenderMeta<T>) => React.ReactElement;
    header: (key: string, data: T[]) => React.ReactElement;
    width?: number | string;
}

export type Column<T> = {
    key: string;
    label?: string;
    header: (key: string, data: T[]) => React.ReactElement;
    render: (item: T, index: number, meta: CellRenderMeta<T>) => React.ReactElement;
    width?: number | string;
    children?: ColumnType<T>[];
};

export type AirTableProps<T> = {
    data: T[];
    columns: Column<T>[];
    rowKeyField?: keyof T;
    defaultColWidth?: number;
    detailRenderer?: (params: { row: T; ri: number }) => React.ReactNode;
    getRowCanExpand?: (row: T, ri: number) => boolean;
    getRowStyle?: (row: T, index: number) => { backgroundColor?: string };
    storageKey?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    pinnedColumnKeys?: string[];
};

export type DragGhost = {
    key: string;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    leftInGrid: number;
    topInGrid: number;
};

export type CellPos = { ri: number; ci: number };
export type SelectionState = {
    start: CellPos | null;
    end: CellPos | null;
    isSelecting: boolean;
};

export const MIN_COL_WIDTH = 80;

/* =========================
   useTable (원본 그대로)
   ========================= */

type PersistedTableState = {
    columnWidths: Record<string, number>;
    columnOrder: string[];
    visibleColumnKeys: string[];
    knownColumnKeys: string[];
};

export type DragState = {
    draggingKey: string | null;
    dragX: number;
    previewOrder: string[] | null;
    version: number;
};

export type UseTableResult<T> = {
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
            render: (item: T, rowIndex: number, meta: CellRenderMeta<T>) => React.ReactElement;
        }[];
    }[];

    columnOrder: string[];
    visibleColumnKeys: string[];
    setVisibleColumnKeys: (keys: string[]) => void;

    allLeafKeys: string[];
    allLeafColumns: ColumnType<T>[];

    drag: DragState;
    startColumnDrag: (key: string, startX: number) => void;
    updateColumnDrag: (x: number) => void;
    setPreviewOrder: (order: string[] | null) => void;
    endColumnDrag: () => void;

    resizeColumn: (colKey: string, width: number) => void;
    commitColumnOrder: (order: string[]) => void;
};

const uniq = (arr: string[]) => Array.from(new Set(arr.map(String)));
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

        return { columnWidths, columnOrder, visibleColumnKeys, knownColumnKeys };
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
    const prev = uniq(prevOrder);
    if (leafKeys.length === 0) return prev;

    const leafSet = new Set(leafKeys);
    const base = prev.filter((k) => leafSet.has(k));
    const next = [...base];

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

const useTable = <T,>({
    columns,
    data,
    defaultColWidth,
    containerPaddingPx,
    containerWidth,
    rowKeyField,
    storageKey,
}: {
    columns: Column<T>[];
    data: T[];
    defaultColWidth: number;
    containerPaddingPx: number;
    containerWidth: number;
    rowKeyField?: string;
    storageKey?: string;
}): UseTableResult<T> => {
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
                    (((_it: T, _idx: number, _meta: CellRenderMeta<T>) => null) as unknown as (
                        item: T,
                        index: number,
                        meta: CellRenderMeta<T>
                    ) => React.ReactElement);
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

    const [persisted] = useState<PersistedTableState | null>(() => loadPersistedTableState(storageKey));

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
        const s = stateRef.current;
        savePersistedTableState(storageKey, {
            columnWidths: s.columnWidths,
            columnOrder: uniq(s.columnOrder),
            visibleColumnKeys: uniq(s.visibleColumnKeys),
            knownColumnKeys: uniq(s.knownColumnKeys),
        });
    }, [storageKey]);

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

                stateRef.current = { ...stateRef.current, visibleColumnKeys: next };
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

        setColumnWidths((prev) => {
            const next: Record<string, number> = { ...prev };

            leafKeys.forEach((k) => {
                const existing = next[k];
                if (typeof existing !== 'number' || existing <= 0) {
                    const base = baseLeafWidthByKey.get(k) ?? defaultColWidth;
                    next[k] = Math.max(MIN_COL_WIDTH, Number.isFinite(base) ? base : defaultColWidth);
                }
            });

            Object.keys(next).forEach((k) => {
                if (!leafKeySet.has(k)) delete next[k];
            });

            return next;
        });

        setColumnOrder((prev) => mergeOrderByLeafKeys(prev, leafKeys));

        setVisibleColumnKeysDesired((prevDesired) => {
            if (!prevDesired || prevDesired.length === 0) return leafKeys;
            if (newKeys.length > 0) return uniq([...prevDesired, ...newKeys]);
            return prevDesired;
        });
    }, [leafKeys, leafKeySet, baseLeafWidthByKey, defaultColWidth]);

    const resizeColumn = useCallback(
        (colKey: string, width: number) => {
            const key = String(colKey);

            setColumnWidths((prev) => {
                const next = { ...prev };
                next[key] = Math.max(MIN_COL_WIDTH, width);

                stateRef.current = { ...stateRef.current, columnWidths: next };
                persistNow();

                return next;
            });
        },
        [persistNow]
    );

    const commitColumnOrder = useCallback(
        (order: string[]) => {
            const nextOrder = uniq(order.map(String)).filter((k) => leafKeySet.has(k));
            if (nextOrder.length === 0) return;

            setColumnOrder(() => {
                stateRef.current = { ...stateRef.current, columnOrder: nextOrder };
                persistNow();
                return nextOrder;
            });
        },
        [leafKeySet, persistNow]
    );

    const [drag, setDrag] = useState<DragState>({
        draggingKey: null,
        dragX: 0,
        previewOrder: null,
        version: 0,
    });

    const startColumnDrag = useCallback((key: string, startX: number) => {
        setDrag({
            draggingKey: key,
            dragX: startX,
            previewOrder: null,
            version: 0,
        });
    }, []);

    const updateColumnDrag = useCallback((x: number) => {
        setDrag((prev) => ({ ...prev, dragX: x }));
    }, []);

    const setPreviewOrder = useCallback((order: string[] | null) => {
        setDrag((prev) => ({
            ...prev,
            previewOrder: order ? uniq(order) : null,
            version: prev.version + 1,
        }));
    }, []);

    const endColumnDrag = useCallback(() => {
        setDrag({
            draggingKey: null,
            dragX: 0,
            previewOrder: null,
            version: 0,
        });
    }, []);

    const effectiveOrder = useMemo(() => {
        if (drag.previewOrder && drag.previewOrder.length > 0) return drag.previewOrder;
        return columnOrder;
    }, [drag.previewOrder, columnOrder]);

    const orderedLeafColumns = useMemo(() => {
        const colMap = new Map<string, ColumnType<T>>();
        leafColumns.forEach((c) => {
            if (!colMap.has(c.key)) colMap.set(c.key, c);
        });

        const orderUnique = uniq(effectiveOrder);
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
    }, [leafColumns, leafKeys, effectiveOrder]);

    const columnRow = useMemo(() => {
        const headerColumns = orderedLeafColumns.reduce<
            { key: string; render: (key: string, data?: T[]) => React.ReactElement; width: number }[]
        >((acc, col) => {
            if (!visibleColumnKeys.includes(col.key)) return acc;

            const base = baseLeafWidthByKey.get(col.key) ?? defaultColWidth;
            const stored = columnWidths[col.key];
            const w = typeof stored === 'number' && stored > 0 ? stored : base;

            acc.push({
                key: col.key,
                render: () => col.header(col.key, data),
                width: Math.round(Math.max(MIN_COL_WIDTH, w)),
            });

            return acc;
        }, []);

        return { key: 'column', columns: headerColumns };
    }, [orderedLeafColumns, visibleColumnKeys, baseLeafWidthByKey, defaultColWidth, columnWidths, data]);

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
                            render: (it: T, idx: number, meta: CellRenderMeta<T>) => leaf.render(it, idx, meta),
                        })),
                };
            }),
        [data, orderedLeafColumns, visibleColumnKeys, rowKeyField]
    );

    return {
        columnRow,
        rows,
        columnOrder: uniq(columnOrder),
        visibleColumnKeys,
        setVisibleColumnKeys,
        allLeafKeys: leafKeys,
        allLeafColumns: leafColumns,
        drag,
        startColumnDrag,
        updateColumnDrag,
        setPreviewOrder,
        endColumnDrag,
        resizeColumn,
        commitColumnOrder,
    };
};

/* =========================
   Context
   ========================= */

type AirTableContextValue<T> = {
    props: AirTableProps<T>;
    wrapperRef: React.MutableRefObject<HTMLDivElement | null>;
    scrollRef: React.MutableRefObject<HTMLDivElement | null>;
    tableAreaRef: React.MutableRefObject<HTMLDivElement | null>;
    state: UseTableResult<T>;

    baseOrder: string[];
    gridTemplateColumns: string;
    widthByKey: Record<string, number>;
    baseXByKey: Record<string, number>;
    offsetByKey: Record<string, number>;

    ghost: DragGhost | null;
    setGhost: React.Dispatch<React.SetStateAction<DragGhost | null>>;

    headerScrollLeft: number;
    setHeaderScrollLeft: React.Dispatch<React.SetStateAction<number>>;

    selection: SelectionState;
    setSelection: React.Dispatch<React.SetStateAction<SelectionState>>;

    resizeRef: React.MutableRefObject<{ key: string; startX: number; startWidth: number } | null>;
    lastMouseClientRef: React.MutableRefObject<{ x: number; y: number } | null>;
    disableShiftAnimationRef: React.MutableRefObject<boolean>;

    getXInGrid: (clientX: number) => number;
    getYInGrid: (clientY: number) => number;
    getShiftStyle: (colKey: string) => React.CSSProperties;
    calcInsertIndex: (x: number, dragging: string) => number;
    isInsideScrollAreaX: (clientX: number) => boolean;

    getRange: () => { top: number; bottom: number; left: number; right: number } | null;
    isCellSelected: (ri: number, ci: number) => boolean;

    expandedRowKeys: Set<string>;
    toggleRowExpanded: (rowKey: string) => void;
    isRowExpanded: (rowKey: string) => boolean;

    getPinnedStyle: (colKey: string, bg?: string, options?: { isHeader?: boolean }) => React.CSSProperties;
};

type Internal = AirTableContextValue<unknown>;

const Context = createContext<Internal | undefined>(undefined);

export const useAirTableContext = <T,>(): AirTableContextValue<T> => {
    const ctx = useContext(Context);
    if (!ctx) throw new Error('AirTable components must be used inside <AirTable>');
    return ctx as AirTableContextValue<T>;
};

/* =========================
   AirTable Component
   ========================= */

const AirTableInner = <T,>({
    data,
    columns,
    rowKeyField,
    defaultColWidth = 160,
    detailRenderer,
    getRowStyle,
    getRowCanExpand,
    storageKey,
    style,
    children,
    pinnedColumnKeys = [],
}: AirTableProps<T>) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const tableAreaRef = useRef<HTMLDivElement | null>(null);

    const [containerWidth, setContainerWidth] = useState(0);
    const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(() => new Set());

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
        containerPaddingPx: 0,
        containerWidth,
        rowKeyField: rowKeyField ? String(rowKeyField) : undefined,
        storageKey,
    });

    const {
        columnRow,
        columnOrder,
        drag,
        commitColumnOrder,
        setPreviewOrder,
        endColumnDrag,
        updateColumnDrag,
        resizeColumn,
    } = state;

    const visibleKeys = useMemo(() => columnRow.columns.map((c) => c.key), [columnRow.columns]);

    const widthByKey = useMemo(() => {
        const map: Record<string, number> = {};
        columnRow.columns.forEach((c) => {
            map[c.key] = c.width;
        });
        return map;
    }, [columnRow.columns]);

    const baseOrder = useMemo(() => {
        // 1) 현재 보여지는 컬럼 순서를 만든다 (기존 로직 유지)
        const base = columnOrder.filter((k) => visibleKeys.includes(k));
        visibleKeys.forEach((k) => {
            if (!base.includes(k)) base.push(k);
        });

        // 2) pinnedColumnKeys 중, 실제로 존재하는 key만 추린다
        const pinned = pinnedColumnKeys.filter((k) => base.includes(k));

        // 3) pinned가 아닌 컬럼만 추린다
        const normal = base.filter((k) => !pinned.includes(k));

        // 4) pinned를 항상 맨 앞으로 붙인다
        return [...pinned, ...normal];
    }, [columnOrder, visibleKeys, pinnedColumnKeys]);

    const previewOrder = useMemo(() => {
        const p = drag.previewOrder?.filter((k) => baseOrder.includes(k)) ?? null;
        if (!p || p.length === 0) return baseOrder;
        return p;
    }, [drag.previewOrder, baseOrder]);

    const gridTemplateColumns = useMemo(
        () => baseOrder.map((k) => `${widthByKey[k] ?? defaultColWidth}px`).join(' '),
        [baseOrder, widthByKey, defaultColWidth]
    );

    const baseXByKey = useMemo(() => {
        const map: Record<string, number> = {};
        let acc = 0;
        baseOrder.forEach((k) => {
            map[k] = acc;
            acc += widthByKey[k] ?? defaultColWidth;
        });
        return map;
    }, [baseOrder, widthByKey, defaultColWidth]);

    const previewXByKey = useMemo(() => {
        const map: Record<string, number> = {};
        let acc = 0;
        previewOrder.forEach((k) => {
            map[k] = acc;
            acc += widthByKey[k] ?? defaultColWidth;
        });
        return map;
    }, [previewOrder, widthByKey, defaultColWidth]);

    const offsetByKey = useMemo(() => {
        const map: Record<string, number> = {};
        baseOrder.forEach((k) => {
            map[k] = (previewXByKey[k] ?? 0) - (baseXByKey[k] ?? 0);
        });
        return map;
    }, [baseOrder, previewXByKey, baseXByKey]);

    // ✅✅✅ 핵심: "테이블 실제 폭" (헤더/바디가 동일한 폭을 공유해야 수평스크롤이 동기화됨)
    const tableMinWidthPx = useMemo(
        () => baseOrder.reduce((acc, k) => acc + (widthByKey[k] ?? defaultColWidth), 0),
        [baseOrder, widthByKey, defaultColWidth]
    );

    const [ghost, setGhost] = useState<DragGhost | null>(null);
    const [headerScrollLeft, setHeaderScrollLeft] = useState(0);

    const disableShiftAnimationRef = useRef(false);
    const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

    const [selection, setSelection] = useState<SelectionState>({
        start: null,
        end: null,
        isSelecting: false,
    });

    const lastMouseClientRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const handleMove = (ev: MouseEvent) => {
            lastMouseClientRef.current = { x: ev.clientX, y: ev.clientY };
        };
        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, []);

    const getXInGrid = useCallback(
        (clientX: number) => {
            const el = scrollRef.current;
            if (!el) return clientX;
            const rect = el.getBoundingClientRect();
            return clientX - rect.left + el.scrollLeft;
        },
        [scrollRef]
    );

    const getYInGrid = useCallback(
        (clientY: number) => {
            const wrap = wrapperRef.current;
            if (!wrap) return clientY;
            const rect = wrap.getBoundingClientRect();
            const scrollTop = scrollRef.current?.scrollTop ?? 0;
            return clientY - rect.top + scrollTop;
        },
        [wrapperRef, scrollRef]
    );

    const isInsideScrollAreaX = useCallback(
        (clientX: number) => {
            const el = scrollRef.current;
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return clientX >= rect.left && clientX <= rect.right;
        },
        [scrollRef]
    );

    const calcInsertIndex = useCallback(
        (x: number, draggingKey: string) => {
            const filtered = baseOrder.filter((k) => k !== draggingKey);

            for (let i = 0; i < filtered.length; i += 1) {
                const key = filtered[i];
                const left = baseXByKey[key] ?? 0;
                const w = widthByKey[key] ?? defaultColWidth;
                const mid = left + w / 2;
                if (x < mid) return i;
            }

            return filtered.length;
        },
        [baseOrder, baseXByKey, widthByKey, defaultColWidth]
    );

    const getShiftStyle = useCallback(
        (colKey: string): React.CSSProperties => {
            const dx = offsetByKey[colKey] ?? 0;

            const transition = disableShiftAnimationRef.current
                ? 'none'
                : drag.draggingKey
                ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'
                : 'transform 240ms ease';

            return { transform: `translateX(${dx}px)`, transition, willChange: 'transform' };
        },
        [offsetByKey, drag.draggingKey]
    );

    const getRange = useCallback(() => {
        if (!selection.start || !selection.end) return null;
        return {
            top: Math.min(selection.start.ri, selection.end.ri),
            bottom: Math.max(selection.start.ri, selection.end.ri),
            left: Math.min(selection.start.ci, selection.end.ci),
            right: Math.max(selection.start.ci, selection.end.ci),
        };
    }, [selection]);

    const isCellSelected = useCallback(
        (ri: number, ci: number) => {
            const r = getRange();
            if (!r) return false;
            return ri >= r.top && ri <= r.bottom && ci >= r.left && ci <= r.right;
        },
        [getRange]
    );

    const toggleRowExpanded = useCallback((rowKey: string) => {
        setExpandedRowKeys((prev) => {
            const next = new Set(prev);
            if (next.has(rowKey)) next.delete(rowKey);
            else next.add(rowKey);
            return next;
        });
    }, []);

    const isRowExpanded = useCallback((rowKey: string) => expandedRowKeys.has(rowKey), [expandedRowKeys]);

    useEffect(() => {
        const shouldAutoScroll = selection.isSelecting || !!drag.draggingKey;
        if (!shouldAutoScroll) return;

        let rafId = 0;

        const tick = () => {
            const scrollEl = scrollRef.current;
            const last = lastMouseClientRef.current;

            if (!scrollEl || !last) {
                rafId = requestAnimationFrame(tick);
                return;
            }

            const rect = scrollEl.getBoundingClientRect();
            const edge = 80;
            const maxSpeed = 48;

            const distLeft = last.x - rect.left;
            const distRight = rect.right - last.x;

            let dx = 0;

            if (distLeft >= 0 && distLeft < edge) {
                const ratio = 1 - distLeft / edge;
                const accel = ratio * ratio; // ✅ 가속 강화 (2제곱)
                dx = -Math.max(2, Math.round(maxSpeed * accel));
            } else if (distRight >= 0 && distRight < edge) {
                const ratio = 1 - distRight / edge;
                const accel = ratio * ratio;
                dx = Math.max(2, Math.round(maxSpeed * accel));
            }

            if (dx !== 0) scrollEl.scrollLeft += dx;

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [selection.isSelecting, drag.draggingKey]);

    useEffect(() => {
        const handleMove = (ev: MouseEvent) => {
            const r = resizeRef.current;
            if (!r) return;

            const x = getXInGrid(ev.clientX);
            const diff = x - r.startX;
            const nextWidth = Math.max(MIN_COL_WIDTH, r.startWidth + diff);

            resizeColumn(r.key, nextWidth);
        };

        const handleUp = () => {
            if (!resizeRef.current) return;
            resizeRef.current = null;
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [getXInGrid, resizeColumn]);

    useEffect(() => {
        const draggingKey = drag.draggingKey;
        if (!draggingKey) return;

        const finalize = () => {
            if (resizeRef.current) return;

            const dragging = drag.draggingKey;
            const final = drag.previewOrder;

            if (!dragging) return;

            if (!final || final.length === 0) {
                setPreviewOrder(null);
                endColumnDrag();
                setGhost(null);
                return;
            }

            disableShiftAnimationRef.current = true;
            commitColumnOrder(final);

            requestAnimationFrame(() => {
                disableShiftAnimationRef.current = false;
            });

            setPreviewOrder(null);
            endColumnDrag();
            setGhost(null);
        };

        const handleMove = (ev: MouseEvent) => {
            if (resizeRef.current) return;

            const x = getXInGrid(ev.clientX);
            const y = getYInGrid(ev.clientY);

            updateColumnDrag(x);

            setGhost((prev) => {
                if (!prev) return prev;
                return { ...prev, offsetX: x - prev.startX, offsetY: y - prev.startY };
            });

            if (!isInsideScrollAreaX(ev.clientX)) return;

            const insertIndex = calcInsertIndex(x, draggingKey);

            const filtered = baseOrder.filter((k) => k !== draggingKey);
            const next = [...filtered];
            next.splice(insertIndex, 0, draggingKey);

            setPreviewOrder(next);
        };

        const handleUp = () => finalize();

        const handleBlur = () => finalize();
        const handleContextMenu = () => finalize();
        const handleDragEnd = () => finalize();
        const handlePointerUp = () => finalize();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') finalize();
        };
        const handleVisibility = () => {
            if (document.hidden) finalize();
        };
        const handleDocMouseLeave = () => finalize();

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        window.addEventListener('blur', handleBlur);
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('dragend', handleDragEnd);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('keydown', handleKeyDown);

        document.addEventListener('visibilitychange', handleVisibility);
        document.addEventListener('mouseleave', handleDocMouseLeave);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);

            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('dragend', handleDragEnd);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('keydown', handleKeyDown);

            document.removeEventListener('visibilitychange', handleVisibility);
            document.removeEventListener('mouseleave', handleDocMouseLeave);
        };
    }, [
        drag.draggingKey,
        drag.previewOrder,
        baseOrder,
        calcInsertIndex,
        getXInGrid,
        getYInGrid,
        isInsideScrollAreaX,
        commitColumnOrder,
        setPreviewOrder,
        updateColumnDrag,
        endColumnDrag,
    ]);

    useEffect(() => {
        const handleUp = () => {
            if (drag.draggingKey) return;
            setSelection((prev) => ({ ...prev, isSelecting: false }));
        };

        window.addEventListener('mouseup', handleUp);
        return () => window.removeEventListener('mouseup', handleUp);
    }, [drag.draggingKey]);

    useEffect(() => {
        const handleCopy = (e: ClipboardEvent) => {
            const r = getRange();
            if (!r) return;
            if (drag.draggingKey) return;

            const tsvRows: string[] = [];

            for (let ri = r.top; ri <= r.bottom; ri += 1) {
                const row = state.rows[ri];
                if (!row) continue;

                const line: string[] = [];

                for (let ci = r.left; ci <= r.right; ci += 1) {
                    const colKey = baseOrder[ci];
                    const id = `__cell_${row.key}_${colKey}`;
                    const el = document.getElementById(id);
                    const text = el?.textContent ?? '';
                    line.push(text.replace(/\n/g, ' '));
                }

                tsvRows.push(line.join('\t'));
            }

            const tsv = tsvRows.join('\n');
            e.clipboardData?.setData('text/plain', tsv);
            e.preventDefault();
        };

        window.addEventListener('copy', handleCopy);
        return () => window.removeEventListener('copy', handleCopy);
    }, [state.rows, baseOrder, getRange, drag.draggingKey]);

    const getPinnedStyle = useCallback(
        (colKey: string, bg?: string, options?: { isHeader?: boolean }): React.CSSProperties => {
            if (!pinnedColumnKeys.includes(colKey)) return {};

            const isHeader = options?.isHeader === true;

            return {
                position: 'sticky',
                left: baseXByKey[colKey] ?? 0,
                zIndex: 50,
                background: bg ?? '#fff',
                transform: 'none',

                // ✅ pinned 헤더일 때만 글자색 흰색
                color: isHeader ? '#fff' : undefined,
            };
        },
        [pinnedColumnKeys, baseXByKey]
    );
    const value: AirTableContextValue<T> = {
        props: {
            data,
            columns,
            rowKeyField,
            defaultColWidth,
            detailRenderer,
            getRowStyle,
            storageKey,
            style,
            children,
            getRowCanExpand,
            pinnedColumnKeys,
        },
        wrapperRef,
        scrollRef,
        tableAreaRef,
        state,

        baseOrder,
        gridTemplateColumns,
        widthByKey,
        baseXByKey,
        offsetByKey,

        ghost,
        setGhost,

        headerScrollLeft,
        setHeaderScrollLeft,

        selection,
        setSelection,

        resizeRef,
        lastMouseClientRef,
        disableShiftAnimationRef,

        getXInGrid,
        getYInGrid,
        getShiftStyle,
        calcInsertIndex,
        isInsideScrollAreaX,

        getRange,
        isCellSelected,

        expandedRowKeys,
        toggleRowExpanded,
        isRowExpanded,

        getPinnedStyle,
    };

    return (
        <Context.Provider value={value as any}>
            <div
                ref={wrapperRef}
                style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                    position: 'relative',
                    overflow: 'hidden', // ✅ 외부 수평스크롤 방지
                    ...style,
                }}
            >
                {children ?? (
                    <>
                        <ColumnVisibilityControl portalId="column-select-box-portal" />
                        <Container>
                            {/* ✅ 헤더 sticky 래퍼가 "테이블 실제 폭"을 가져야 수평스크롤이 같이 움직임 */}
                            <div
                                style={{
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 30,
                                    background: '#fff',
                                    minWidth: `${tableMinWidthPx}px`, // ✅ 핵심
                                }}
                            >
                                <Header />
                            </div>

                            <Body />
                            <Ghost />
                        </Container>
                    </>
                )}
            </div>
        </Context.Provider>
    );
};

const AirTable = AirTableInner as typeof AirTableInner & {
    Container: typeof Container;
    Header: typeof Header;
    Body: typeof Body;
    Ghost: typeof Ghost;
    RowToggle: typeof RowToggle;
    ColumnSelectBoxPortal: typeof ColumnSelectBoxPortal;
};

AirTable.Container = Container;
AirTable.Header = Header;
AirTable.Body = Body;
AirTable.Ghost = Ghost;
AirTable.RowToggle = RowToggle;
AirTable.ColumnSelectBoxPortal = ColumnSelectBoxPortal;

export default AirTable;
