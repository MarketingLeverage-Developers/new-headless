// src/shared/headless/AirTable/AirTable.tsx

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Container } from './components/Container';
import { Header } from './components/Header';
import { Body } from './components/Body';
import { Ghost } from './components/Ghost';
import { ColumnVisibilityControl } from './components/ColumnVisibilityControl';
import RowToggle from './components/RowToggle';
import { ColumnSelectBoxPortal } from './components/ColumnSelectBoxPortal';

import { useContainerWidth } from './hooks/useContainerWidth';
import { useLastPointerPosition } from './hooks/useLastPointerPosition';
import { useSelectionRange } from './hooks/useSelectionRange';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useColumnResize } from './hooks/useColumnResize';
import { useColumnDrag } from './hooks/useColumnDrag';
import { useSelectionMouseUpEnd } from './hooks/useSelectionMouseUpEnd';
import { useCopySelection } from './hooks/useCopySelection';
import { usePinnedStyle } from './hooks/usePinnedStyle';
import { useGridMeta } from './hooks/useGridMeta';
import { useGridPointer } from './hooks/useGridPointer';
import { CellContextMenuPortal } from './components/CellContextMenuPortal';

/* =========================
   Types
   ========================= */

export type CellRenderMeta<T> = {
    rowKey: string;
    ri: number;
    level?: number; // ✅ flatten 용 level
    toggleRowExpanded: (rowKey: string) => void;
    isRowExpanded: (rowKey: string) => boolean;
};

export type SortDirection = 'asc' | 'desc';
export type SortState = { key: string; direction: SortDirection } | null;
export type SortValue = string | number | boolean | Date | null | undefined;
export type SortValueGetter<T> = (row: T) => SortValue;
export type Sorter<T> = (a: T, b: T) => number;
export type FilterState = Record<string, { excluded: string[] }>;

export interface ColumnType<T> {
    key: string;
    label?: string;
    render: (item: T, index: number, meta: CellRenderMeta<T>) => React.ReactElement;
    header: (key: string, data: T[]) => React.ReactElement;
    width?: number | string;
    filter?: React.ReactNode;
    sortValue?: SortValueGetter<T>;
    sorter?: Sorter<T>;
}

export type Column<T> = {
    key: string;
    label?: string;
    header: (key: string, data: T[]) => React.ReactElement;
    render: (item: T, index: number, meta: CellRenderMeta<T>) => React.ReactElement;
    width?: number | string;
    children?: ColumnType<T>[];
    filter?: React.ReactNode;
    sortValue?: SortValueGetter<T>;
    sorter?: Sorter<T>;
};

// src/shared/headless/AirTable/AirTable.tsx

export type AirTableProps<T> = {
    data: T[];
    columns: Column<T>[];
    rowKeyField?: keyof T;
    defaultColWidth?: number;
    detailRenderer?: (params: { row: T; ri: number }) => React.ReactNode;
    getRowCanExpand?: (row: T, ri: number) => boolean;
    getRowStyle?: (row: T, index: number) => React.CSSProperties;
    storageKey?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    pinnedColumnKeys?: string[];
    pinnedHeaderBgColor?: string | ((colKey: string) => string | undefined);
    pinnedHeaderTextColor?: string | ((colKey: string) => string | undefined);
    getExpandedRows?: (row: T, ri: number) => T[];
    getRowLevel?: (row: T, ri: number) => number;
    defaultExpandedRowKeys?: string[];
    enableAnimation?: boolean;
    animationRowLimit?: number;
    enableVirtualization?: boolean;
    virtualRowHeight?: number;
    virtualOverscan?: number;
    persistExpandedRowKeys?: boolean;

    /** ✅ 추가: 남는 폭 채우기 on/off */
    fillContainerWidth?: boolean;

    /** ✅ 정렬 */
    sortState?: SortState;
    defaultSortState?: SortState;
    onSortChange?: (next: SortState) => void;
    sortMode?: 'internal' | 'external';

    /** ✅ 필터 */
    filterState?: FilterState;
    defaultFilterState?: FilterState;
    onFilterChange?: (next: FilterState) => void;
    filterMode?: 'internal' | 'external';
    filterOptionsData?: T[];
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
   useTable (기존 유지 + flatten 지원)
   ========================= */

type PersistedTableState = {
    columnWidths: Record<string, number>;
    columnOrder: string[];
    visibleColumnKeys: string[];
    knownColumnKeys: string[];
    pinnedColumnKeys?: string[];
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
            filter?: React.ReactNode;
        }[];
    };
    rows: {
        key: string;
        item: T;
        level: number;
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

    pinnedColumnKeys: string[];
    setPinnedColumnKeys: (keys: string[]) => void;
};

export type SortConfig<T> = {
    sortValue?: SortValueGetter<T>;
    sorter?: Sorter<T>;
};

const uniq = (arr: string[]) => Array.from(new Set(arr.map(String)));
const normalizeStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

const normalizeSortValue = (value: SortValue): string | number => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === null || value === undefined) return '';
    return String(value);
};

const normalizeFilterKey = (value: SortValue): string => String(normalizeSortValue(value));

const compareSortValue = (a: SortValue, b: SortValue): number => {
    const aEmpty = a === null || a === undefined;
    const bEmpty = b === null || b === undefined;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    const av = normalizeSortValue(a);
    const bv = normalizeSortValue(b);

    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
};

export const collectSortConfig = <T,>(columns: Column<T>[]): Map<string, SortConfig<T>> => {
    const map = new Map<string, SortConfig<T>>();

    const visit = (col: Column<T> | ColumnType<T>) => {
        if ('children' in col && Array.isArray(col.children) && col.children.length > 0) {
            col.children.forEach(visit);
            return;
        }

        const key = String(col.key);
        if (col.sorter || col.sortValue) {
            map.set(key, { sortValue: col.sortValue, sorter: col.sorter });
        }
    };

    columns.forEach(visit);
    return map;
};

export const sortDataByConfig = <T,>(
    data: T[],
    sortState: SortState,
    sortConfigByKey: Map<string, SortConfig<T>>
): T[] => {
    if (!sortState) return data;
    const config = sortConfigByKey.get(sortState.key);
    if (!config) return data;

    const entries = data.map((item, index) => ({
        item,
        index,
        value: config.sortValue ? config.sortValue(item) : undefined,
    }));

    const compare = (a: (typeof entries)[number], b: (typeof entries)[number]) => {
        const base = config.sorter ? config.sorter(a.item, b.item) : compareSortValue(a.value, b.value);
        if (base !== 0) return sortState.direction === 'asc' ? base : -base;
        return a.index - b.index;
    };

    const next = [...entries];
    next.sort(compare);
    return next.map((entry) => entry.item);
};

export const filterDataByConfig = <T,>(
    data: T[],
    filterState: FilterState | undefined,
    sortConfigByKey: Map<string, SortConfig<T>>
): T[] => {
    if (!filterState) return data;

    const entries = Object.entries(filterState).filter(([, v]) => (v?.excluded?.length ?? 0) > 0);
    if (entries.length === 0) return data;

    const excludedMap = new Map<string, Set<string>>();
    entries.forEach(([key, value]) => {
        excludedMap.set(String(key), new Set((value?.excluded ?? []).map(String)));
    });

    return data.filter((item) => {
        for (const [colKey, excluded] of excludedMap.entries()) {
            const config = sortConfigByKey.get(colKey);
            if (!config?.sortValue) continue;
            const raw = config.sortValue(item);
            const key = normalizeFilterKey(raw);
            if (excluded.has(key)) return false;
        }
        return true;
    });
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

        const pinnedColumnKeys = uniq(normalizeStringArray((obj as any).pinnedColumnKeys));

        return { columnWidths, columnOrder, visibleColumnKeys, knownColumnKeys, pinnedColumnKeys };
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

const getExpandedRowKeysStorageKey = (storageKey?: string) =>
    storageKey ? `${storageKey}__expandedRowKeys` : undefined;

const loadPersistedExpandedRowKeys = (storageKey?: string): string[] | null => {
    const key = getExpandedRowKeysStorageKey(storageKey);
    if (!key) return null;
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return null;
        return parsed.map((k) => String(k));
    } catch {
        return null;
    }
};

const savePersistedExpandedRowKeys = (storageKey: string, keys: string[]) => {
    const key = getExpandedRowKeysStorageKey(storageKey);
    if (!key) return;
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(keys));
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

/* =========================
   ✅✅✅ 추가: rowKey 생성 유틸
   - 펼침 rowKey가 항상 여기 기준으로 만들어져야 한다
   ========================= */

const getRowKey = <T,>(params: { item: T; ri: number; rowKeyField?: string }) => {
    const { item, ri, rowKeyField } = params;

    const rawKey = rowKeyField ? (item as any)[rowKeyField] : undefined;

    return typeof rawKey === 'string' || typeof rawKey === 'number' ? String(rawKey) : `row-${ri}`;
};

const useTable = <T,>({
    columns,
    data,
    defaultColWidth,
    containerPaddingPx,
    containerWidth,
    rowKeyField,
    storageKey,
    initialPinnedColumnKeys,
    getExpandedRows,
    getRowLevel,
    expandedRowKeys,
}: {
    columns: Column<T>[];
    data: T[];
    defaultColWidth: number;
    containerPaddingPx: number;
    containerWidth: number;
    rowKeyField?: string;
    storageKey?: string;
    initialPinnedColumnKeys?: string[];

    /** ✅ flatten */
    getExpandedRows?: (row: T, ri: number) => T[];
    getRowLevel?: (row: T, ri: number) => number;
    expandedRowKeys: Set<string>;
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
                        filter: col.filter,
                        sortValue: col.sortValue,
                        sorter: col.sorter,
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

    useEffect(() => {
        if (!storageKey) {
            setPersisted(null);
            return;
        }
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

    const [pinnedColumnKeys, setPinnedColumnKeysState] = useState<string[]>(() => {
        const fromPersisted = persisted?.pinnedColumnKeys ?? [];
        if (fromPersisted.length > 0) return uniq(fromPersisted);
        return uniq(initialPinnedColumnKeys ?? []);
    });

    const knownSetRef = useRef<Set<string>>(new Set(persisted?.knownColumnKeys ?? []));
    useMemo(() => {
        knownSetRef.current = new Set(knownColumnKeys);
        return null;
    }, [knownColumnKeys]);

    // storageKey 변경 시 persisted hydrate 준비
    const pendingHydrationRef = useRef(false);
    const hydratedRef = useRef(false);
    const stableLeafKeysTimerRef = useRef<number | null>(null);

    useEffect(() => {
        hydratedRef.current = false;
        pendingHydrationRef.current = true;

        if (stableLeafKeysTimerRef.current) {
            window.clearTimeout(stableLeafKeysTimerRef.current);
            stableLeafKeysTimerRef.current = null;
        }
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey) return;
        if (!pendingHydrationRef.current) return;
        if (hydratedRef.current) return;

        if (stableLeafKeysTimerRef.current) {
            window.clearTimeout(stableLeafKeysTimerRef.current);
        }

        // leafKeys가 안정화될 때까지 대기 후 hydrate 1회
        stableLeafKeysTimerRef.current = window.setTimeout(() => {
            stableLeafKeysTimerRef.current = null;

            if (!storageKey) return;
            if (hydratedRef.current) return;
            if (!pendingHydrationRef.current) return;

            const nextWidths = persisted?.columnWidths ?? {};
            const nextOrder =
                persisted?.columnOrder && persisted.columnOrder.length > 0 ? persisted.columnOrder : leafKeys;
            const nextVisible =
                persisted?.visibleColumnKeys && persisted.visibleColumnKeys.length > 0
                    ? persisted.visibleColumnKeys
                    : leafKeys;
            const nextKnown = persisted?.knownColumnKeys ?? [];
            const nextPinned = persisted?.pinnedColumnKeys ?? initialPinnedColumnKeys ?? [];

            setColumnWidths(nextWidths);
            setColumnOrder(uniq(nextOrder));
            setVisibleColumnKeysDesired(uniq(nextVisible));
            setKnownColumnKeys(uniq(nextKnown));
            setPinnedColumnKeysState(uniq(nextPinned));
            knownSetRef.current = new Set(uniq(nextKnown));

            hydratedRef.current = true;
            pendingHydrationRef.current = false;
        }, 60);
    }, [storageKey, leafKeys, persisted, initialPinnedColumnKeys]);

    const stateRef = useRef<PersistedTableState>({
        columnWidths,
        columnOrder,
        visibleColumnKeys: visibleColumnKeysDesired,
        knownColumnKeys,
        pinnedColumnKeys,
    });

    useMemo(() => {
        stateRef.current = {
            columnWidths,
            columnOrder,
            visibleColumnKeys: visibleColumnKeysDesired,
            knownColumnKeys,
            pinnedColumnKeys,
        };
        return null;
    }, [columnWidths, columnOrder, visibleColumnKeysDesired, knownColumnKeys, pinnedColumnKeys]);

    const persistNow = useCallback(() => {
        if (!storageKey) return;
        if (pendingHydrationRef.current && !hydratedRef.current) return;
        const s = stateRef.current;
        savePersistedTableState(storageKey, {
            columnWidths: s.columnWidths,
            columnOrder: uniq(s.columnOrder),
            visibleColumnKeys: uniq(s.visibleColumnKeys),
            knownColumnKeys: uniq(s.knownColumnKeys),
            pinnedColumnKeys: uniq(s.pinnedColumnKeys ?? []),
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

    const setPinnedColumnKeys = useCallback(
        (keys: string[]) => {
            const next = uniq(keys.map(String)).filter((k) => leafKeySet.has(k));
            setPinnedColumnKeysState(next);

            stateRef.current = { ...stateRef.current, pinnedColumnKeys: next };
            persistNow();
        },
        [leafKeySet, persistNow]
    );

    useMemo(() => {
        if (leafKeys.length === 0) return null;

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

        setPinnedColumnKeysState((prevPinned) => prevPinned.filter((k) => leafKeySet.has(k)));

        return null;
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
            {
                key: string;
                render: (key: string, data?: T[]) => React.ReactElement;
                width: number;
                filter?: React.ReactNode;
            }[]
        >((acc, col) => {
            if (!visibleColumnKeys.includes(col.key)) return acc;

            const base = baseLeafWidthByKey.get(col.key) ?? defaultColWidth;
            const stored = columnWidths[col.key];
            const w = typeof stored === 'number' && stored > 0 ? stored : base;

            acc.push({
                key: col.key,
                render: () => col.header(col.key, data),
                width: Math.round(Math.max(MIN_COL_WIDTH, w)),
                filter: col.filter,
            });

            return acc;
        }, []);

        return { key: 'column', columns: headerColumns };
    }, [orderedLeafColumns, visibleColumnKeys, baseLeafWidthByKey, defaultColWidth, columnWidths, data]);

    /** ✅✅✅ rows: flatten 적용 */
    const rows = useMemo(() => {
        const result: UseTableResult<T>['rows'] = [];

        data.forEach((item, ri) => {
            const rowKey = getRowKey({ item, ri, rowKeyField });

            const level = getRowLevel ? getRowLevel(item, ri) : 0;

            const cells = orderedLeafColumns
                .filter((leaf) => visibleColumnKeys.includes(leaf.key))
                .map((leaf) => ({
                    key: leaf.key,
                    render: (it: T, idx: number, meta: CellRenderMeta<T>) => leaf.render(it, idx, meta),
                }));

            result.push({
                key: rowKey,
                item,
                level,
                cells,
            });

            const expanded = expandedRowKeys.has(rowKey);
            if (!expanded) return;
            if (!getExpandedRows) return;

            const children = getExpandedRows(item, ri) ?? [];
            children.forEach((child, ci) => {
                const childKey = `${rowKey}__child-${ci}`;

                result.push({
                    key: childKey,
                    item: child,
                    level: level + 1,
                    cells,
                });
            });
        });

        return result;
    }, [data, rowKeyField, orderedLeafColumns, visibleColumnKeys, getExpandedRows, getRowLevel, expandedRowKeys]);

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

        pinnedColumnKeys,
        setPinnedColumnKeys,
    };
};

/* =========================
   Context ✅ 유지
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
    lastMouseClientRef: React.MutableRefObject<{ x: string; y: string } | null>;
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

    /** ✅✅✅ 추가: 전체 열기/닫기 */
    expandAllRows: () => void;
    collapseAllRows: () => void;
    isAllExpanded: () => boolean;

    getPinnedStyle: (colKey: string, bg?: string, options?: { isHeader?: boolean }) => React.CSSProperties;

    pinnedColumnKeys: string[];
    setPinnedColumnKeys: (keys: string[]) => void;

    filterState: FilterState;
    setFilterState: (next: FilterState) => void;
    sortState: SortState;
    setSortState: (next: SortState) => void;
    sortConfigByKey: Map<string, SortConfig<T>>;
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
    pinnedColumnKeys: initialPinnedColumnKeys = [],
    pinnedHeaderBgColor,
    pinnedHeaderTextColor,
    getExpandedRows,
    getRowLevel,
    defaultExpandedRowKeys = [],
    enableAnimation,
    animationRowLimit,
    enableVirtualization,
    virtualRowHeight,
    virtualOverscan,
    persistExpandedRowKeys = false,

    fillContainerWidth = true, // ✅ 기본은 켜두고(원하면 false로 바꿔도 됨)
    sortState: sortStateProp,
    defaultSortState = null,
    onSortChange,
    sortMode = 'internal',
    filterState: filterStateProp,
    defaultFilterState = {},
    onFilterChange,
    filterMode = 'internal',
    filterOptionsData,
}: AirTableProps<T>) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const tableAreaRef = useRef<HTMLDivElement | null>(null);

    const sortConfigByKey = useMemo(() => collectSortConfig(columns), [columns]);

    const isSortControlled = sortStateProp !== undefined;
    const [innerSortState, setInnerSortState] = useState<SortState>(defaultSortState);
    const sortState = isSortControlled ? (sortStateProp as SortState) : innerSortState;

    const setSortState = useCallback(
        (next: SortState) => {
            if (!isSortControlled) setInnerSortState(next);
            onSortChange?.(next);
        },
        [isSortControlled, onSortChange]
    );

    const isFilterControlled = filterStateProp !== undefined;
    const [innerFilterState, setInnerFilterState] = useState<FilterState>(defaultFilterState);
    const filterState = isFilterControlled ? (filterStateProp as FilterState) : innerFilterState;

    const setFilterState = useCallback(
        (next: FilterState) => {
            if (!isFilterControlled) setInnerFilterState(next);
            onFilterChange?.(next);
        },
        [isFilterControlled, onFilterChange]
    );

    const filteredData = useMemo(
        () => (filterMode === 'internal' ? filterDataByConfig(data, filterState, sortConfigByKey) : data),
        [data, filterState, sortConfigByKey, filterMode]
    );

    const sortedData = useMemo(
        () => (sortMode === 'internal' ? sortDataByConfig(filteredData, sortState, sortConfigByKey) : filteredData),
        [filteredData, sortState, sortConfigByKey, sortMode]
    );

    const perfEnabled = typeof window !== 'undefined' && Boolean((window as any).__AIRTABLE_PERF__);
    const perfLabel = useMemo(() => {
        if (typeof window === 'undefined') return storageKey ?? 'AirTable';
        const globalLabel = (window as any).__AIRTABLE_PERF_LABEL__;
        return typeof globalLabel === 'string' && globalLabel.trim() !== '' ? globalLabel : (storageKey ?? 'AirTable');
    }, [storageKey]);
    const perfRef = useRef<{ reason: string; start: number } | null>(null);
    const prevSortRef = useRef<SortState | undefined>(undefined);
    const prevFilterRef = useRef<FilterState | undefined>(undefined);

    const containerWidth = useContainerWidth(wrapperRef);

    const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(() => {
        if (persistExpandedRowKeys && storageKey) {
            const persisted = loadPersistedExpandedRowKeys(storageKey);
            if (persisted !== null) return new Set(persisted);
        }
        return new Set(defaultExpandedRowKeys.map(String));
    });
    const lastExpandedStorageKeyRef = useRef<string | undefined>(storageKey);
    const skipNextExpandedPersistRef = useRef(false);

    const expandableRowKeys = useMemo(() => {
        const keys: string[] = [];

        sortedData.forEach((item, ri) => {
            const rowKey = getRowKey({ item, ri, rowKeyField: rowKeyField ? String(rowKeyField) : undefined });
            const canExpand = getRowCanExpand ? getRowCanExpand(item, ri) : !!getExpandedRows;
            if (canExpand) keys.push(rowKey);
        });

        return keys;
    }, [sortedData, rowKeyField, getRowCanExpand, getExpandedRows]);

    useEffect(() => {
        if (!persistExpandedRowKeys) {
            lastExpandedStorageKeyRef.current = undefined;
            return;
        }

        if (lastExpandedStorageKeyRef.current === storageKey) return;

        lastExpandedStorageKeyRef.current = storageKey;
        skipNextExpandedPersistRef.current = true;

        const persisted = storageKey ? loadPersistedExpandedRowKeys(storageKey) : null;
        if (persisted !== null) {
            setExpandedRowKeys(new Set(persisted));
        } else {
            setExpandedRowKeys(new Set(defaultExpandedRowKeys.map(String)));
        }
    }, [persistExpandedRowKeys, storageKey, defaultExpandedRowKeys]);

    useEffect(() => {
        if (!persistExpandedRowKeys || !storageKey) return;
        if (skipNextExpandedPersistRef.current) {
            skipNextExpandedPersistRef.current = false;
            return;
        }
        savePersistedExpandedRowKeys(storageKey, Array.from(expandedRowKeys));
    }, [expandedRowKeys, persistExpandedRowKeys, storageKey]);

    const expandAllRows = useCallback(() => {
        setExpandedRowKeys(new Set(expandableRowKeys));
    }, [expandableRowKeys]);

    const collapseAllRows = useCallback(() => {
        setExpandedRowKeys(new Set());
    }, []);

    const isAllExpanded = useCallback(() => {
        if (expandableRowKeys.length === 0) return false;
        return expandableRowKeys.every((k) => expandedRowKeys.has(k));
    }, [expandableRowKeys, expandedRowKeys]);

    const state = useTable<T>({
        columns,
        data: sortedData,
        defaultColWidth,
        containerPaddingPx: 0,
        containerWidth,
        rowKeyField: rowKeyField ? String(rowKeyField) : undefined,
        storageKey,
        initialPinnedColumnKeys,
        getExpandedRows,
        getRowLevel,
        expandedRowKeys,
    });

    useEffect(() => {
        if (!perfEnabled) return;
        if (prevSortRef.current === undefined) {
            prevSortRef.current = sortState ?? null;
            return;
        }

        const prev = prevSortRef.current;
        if (prev?.key === sortState?.key && prev?.direction === sortState?.direction) return;

        prevSortRef.current = sortState ?? null;
        perfRef.current = { reason: 'sort', start: performance.now() };
    }, [perfEnabled, sortState]);

    useEffect(() => {
        if (!perfEnabled) return;
        if (prevFilterRef.current === undefined) {
            prevFilterRef.current = filterState;
            return;
        }
        if (prevFilterRef.current === filterState) return;

        prevFilterRef.current = filterState;
        perfRef.current = { reason: 'filter', start: performance.now() };
    }, [perfEnabled, filterState]);

    useEffect(() => {
        if (!perfEnabled || !perfRef.current) return;
        const { reason, start } = perfRef.current;
        perfRef.current = null;
        const total = sortedData.length;
        const visible = state.rows.length;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const end = performance.now();
                const ms = (end - start).toFixed(1);

                console.log(`[AirTable][${perfLabel}] ${reason} total=${total} visible=${visible} ${ms}ms`);
            });
        });
    }, [perfEnabled, perfLabel, sortedData.length, state.rows]);

    const {
        columnRow,
        columnOrder,
        drag,
        commitColumnOrder,
        setPreviewOrder,
        endColumnDrag,
        updateColumnDrag,
        resizeColumn,
        pinnedColumnKeys,
        setPinnedColumnKeys,
    } = state;

    const visibleKeys = useMemo(() => columnRow.columns.map((c) => c.key), [columnRow.columns]);

    const widthByKey = useMemo(() => {
        const map: Record<string, number> = {};
        columnRow.columns.forEach((c) => {
            map[c.key] = c.width;
        });
        return map;
    }, [columnRow.columns]);

    const { baseOrder, gridTemplateColumns, baseXByKey, offsetByKey, tableMinWidthPx, layoutWidthByKey } = useGridMeta({
        columnOrder,
        visibleKeys,
        widthByKey,
        defaultColWidth,
        pinnedColumnKeys,
        dragPreviewOrder: drag.previewOrder,
        containerWidthPx: containerWidth, // ✅ 추가
        fillContainerWidth,
    });

    const { getXInGrid, getYInGrid, isInsideScrollAreaX, calcInsertIndex } = useGridPointer({
        wrapperRef,
        scrollRef,
        baseOrder,
        baseXByKey,
        widthByKey: layoutWidthByKey, // ✅ 변경 (pointer도 “채움 반영” 폭 기준)
        defaultColWidth,
    });

    const calcInsertIndexWithin = useCallback(
        (x: number, draggingKey: string, scopeKeys: string[]) => {
            const filtered = scopeKeys.filter((k) => k !== draggingKey);

            for (let i = 0; i < filtered.length; i += 1) {
                const key = filtered[i];
                const left = baseXByKey[key] ?? 0;
                const w = layoutWidthByKey[key] ?? defaultColWidth;
                const mid = left + w / 2;
                if (x < mid) return i;
            }

            return filtered.length;
        },
        [baseXByKey, layoutWidthByKey, defaultColWidth]
    );

    const getPreviewOrderForDrag = useCallback(
        (x: number, dragKey: string) => {
            const isPinned = pinnedColumnKeys.includes(dragKey);

            if (!isPinned) {
                const insertIndex = calcInsertIndex(x, dragKey);
                const filtered = baseOrder.filter((k) => k !== dragKey);
                const next = [...filtered];
                next.splice(insertIndex, 0, dragKey);
                return next;
            }

            const pinned = pinnedColumnKeys.filter((k) => baseOrder.includes(k));
            if (pinned.length === 0) return null;

            const normal = baseOrder.filter((k) => !pinned.includes(k));
            const insertIndex = calcInsertIndexWithin(x, dragKey, pinned);
            const filteredPinned = pinned.filter((k) => k !== dragKey);
            const nextPinned = [...filteredPinned];
            nextPinned.splice(insertIndex, 0, dragKey);

            return [...nextPinned, ...normal];
        },
        [pinnedColumnKeys, baseOrder, calcInsertIndex, calcInsertIndexWithin]
    );

    const commitColumnOrderForDrag = useCallback(
        (order: string[], dragKey: string) => {
            commitColumnOrder(order);

            if (!pinnedColumnKeys.includes(dragKey)) return;

            const pinnedSet = new Set(pinnedColumnKeys);
            const orderSet = new Set(order);
            const nextPinnedVisible = order.filter((k) => pinnedSet.has(k));
            if (nextPinnedVisible.length === 0) return;

            let i = 0;
            const nextPinned = pinnedColumnKeys.map((k) => {
                if (!orderSet.has(k)) return k;
                const next = nextPinnedVisible[i] ?? k;
                i += 1;
                return next;
            });

            setPinnedColumnKeys(nextPinned);
        },
        [commitColumnOrder, pinnedColumnKeys, setPinnedColumnKeys]
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

    const lastMouseClientRef = useLastPointerPosition();

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

    const { getRange, isCellSelected } = useSelectionRange(selection);

    const toggleRowExpanded = useCallback((rowKey: string) => {
        setExpandedRowKeys((prev) => {
            const next = new Set(prev);
            const key = String(rowKey);

            if (next.has(key)) next.delete(key);
            else next.add(key);

            return next;
        });
    }, []);

    const isRowExpanded = useCallback((rowKey: string) => expandedRowKeys.has(String(rowKey)), [expandedRowKeys]);

    useAutoScroll({
        scrollRef,
        lastMouseClientRef,
        enabled: selection.isSelecting || !!drag.draggingKey,
    });

    useColumnResize({
        resizeRef,
        getXInGrid,
        resizeColumn,
    });

    useColumnDrag({
        dragKey: drag.draggingKey,
        resizeRef,
        dragPreviewOrder: drag.previewOrder,
        baseOrder,
        getXInGrid,
        getYInGrid,
        isInsideScrollAreaX,
        calcInsertIndex,
        updateColumnDrag,
        setGhost,
        setPreviewOrder,
        endColumnDrag,
        commitColumnOrder,
        getPreviewOrder: getPreviewOrderForDrag,
        onCommitOrder: commitColumnOrderForDrag,
        disableShiftAnimationRef,
    });

    useSelectionMouseUpEnd({
        drag,
        setSelection,
    });

    useCopySelection({
        stateRows: state.rows,
        baseOrder,
        getRange,
        draggingKey: drag.draggingKey,
    });

    const { getPinnedStyle } = usePinnedStyle({
        pinnedColumnKeys,
        baseXByKey,
    });

    const value = {
        props: {
            data: sortedData,
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
            pinnedHeaderBgColor,
            pinnedHeaderTextColor,
            getExpandedRows,
            getRowLevel,
            defaultExpandedRowKeys,
            enableAnimation,
            animationRowLimit,
            enableVirtualization,
            virtualRowHeight,
            virtualOverscan,
            filterOptionsData,
        },
        wrapperRef,
        scrollRef,
        tableAreaRef,
        state,

        baseOrder,
        gridTemplateColumns,

        // ✅ 변경: Context의 widthByKey도 “레이아웃용 폭”으로 (Header/Body/Pointer 모두 일치)
        widthByKey: layoutWidthByKey,
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

        expandAllRows,
        collapseAllRows,
        isAllExpanded,

        getPinnedStyle,

        pinnedColumnKeys,
        setPinnedColumnKeys,

        filterState,
        setFilterState,
        sortState,
        setSortState,
        sortConfigByKey,
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
                    overflow: 'hidden',
                    ...style,
                }}
            >
                {children ?? (
                    <>
                        <ColumnVisibilityControl portalId="column-select-box-portal" />
                        <Container>
                            <div
                                style={{
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 30,
                                    background: '#fff',
                                    minWidth: `${tableMinWidthPx}px`,
                                }}
                            >
                                <Header />
                            </div>

                            <Body />
                            <Ghost />
                        </Container>
                    </>
                )}
                <CellContextMenuPortal />
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
    CellContextMenuPortal: typeof CellContextMenuPortal;
};

AirTable.Container = Container;
AirTable.Header = Header;
AirTable.Body = Body;
AirTable.Ghost = Ghost;
AirTable.RowToggle = RowToggle;
AirTable.ColumnSelectBoxPortal = ColumnSelectBoxPortal;
AirTable.CellContextMenuPortal = CellContextMenuPortal;

export default AirTable;
