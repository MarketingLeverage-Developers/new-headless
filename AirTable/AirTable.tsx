// src/shared/headless/AirTable/AirTable.tsx

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
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

export interface ColumnType<T> {
    key: string;
    label?: string;
    render: (item: T, index: number, meta: CellRenderMeta<T>) => React.ReactElement;
    header: (key: string, data: T[]) => React.ReactElement;
    width?: number | string;
    filter?: React.ReactNode;
}

export type Column<T> = {
    key: string;
    label?: string;
    header: (key: string, data: T[]) => React.ReactElement;
    render: (item: T, index: number, meta: CellRenderMeta<T>) => React.ReactElement;
    width?: number | string;
    children?: ColumnType<T>[];
    filter?: React.ReactNode;
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

    /** ✅ flatten props */
    getExpandedRows?: (row: T, ri: number) => T[];
    getRowLevel?: (row: T, ri: number) => number;

    /** ✅✅✅ 추가: 기본으로 펼쳐져 있을 rowKey 목록 */
    defaultExpandedRowKeys?: string[];
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
    getExpandedRows,
    getRowLevel,
    defaultExpandedRowKeys = [], // ✅✅✅ 추가
}: AirTableProps<T>) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const tableAreaRef = useRef<HTMLDivElement | null>(null);

    const containerWidth = useContainerWidth(wrapperRef);

    /** ✅✅✅ 기본 펼침 rowKey를 Set 초기값으로 사용 */
    const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(
        () => new Set(defaultExpandedRowKeys.map(String))
    );

    /** ✅✅✅ (1) expand 가능한 rowKey 리스트를 만든다 */
    const expandableRowKeys = useMemo(() => {
        const keys: string[] = [];

        data.forEach((item, ri) => {
            const rowKey = getRowKey({ item, ri, rowKeyField: rowKeyField ? String(rowKeyField) : undefined });

            // ✅ getRowCanExpand가 있으면 그것이 기준, 없으면 getExpandedRows 존재 여부로 판단
            const canExpand = getRowCanExpand ? getRowCanExpand(item, ri) : !!getExpandedRows;

            if (canExpand) keys.push(rowKey);
        });

        return keys;
    }, [data, rowKeyField, getRowCanExpand, getExpandedRows]);

    /** ✅✅✅ (2) 전체 열기 */
    const expandAllRows = useCallback(() => {
        setExpandedRowKeys(new Set(expandableRowKeys));
    }, [expandableRowKeys]);

    /** ✅✅✅ (3) 전체 닫기 */
    const collapseAllRows = useCallback(() => {
        setExpandedRowKeys(new Set());
    }, []);

    /** ✅✅✅ (4) 전체가 열려있는지 여부 */
    const isAllExpanded = useCallback(() => {
        if (expandableRowKeys.length === 0) return false;
        return expandableRowKeys.every((k) => expandedRowKeys.has(k));
    }, [expandableRowKeys, expandedRowKeys]);

    const state = useTable<T>({
        columns,
        data,
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

    const { baseOrder, gridTemplateColumns, baseXByKey, offsetByKey, tableMinWidthPx } = useGridMeta({
        columnOrder,
        visibleKeys,
        widthByKey,
        defaultColWidth,
        pinnedColumnKeys,
        dragPreviewOrder: drag.previewOrder,
    });

    const { getXInGrid, getYInGrid, isInsideScrollAreaX, calcInsertIndex } = useGridPointer({
        wrapperRef,
        scrollRef,
        baseOrder,
        baseXByKey,
        widthByKey,
        defaultColWidth,
    });

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
            getExpandedRows,
            getRowLevel,
            defaultExpandedRowKeys,
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

        /** ✅✅✅ 추가 */
        expandAllRows,
        collapseAllRows,
        isAllExpanded,

        getPinnedStyle,

        pinnedColumnKeys,
        setPinnedColumnKeys,
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
