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
   useTable (원본 + pinned persist) ✅ 유지
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

const useTable = <T,>({
    columns,
    data,
    defaultColWidth,
    containerPaddingPx,
    containerWidth,
    rowKeyField,
    storageKey,
    initialPinnedColumnKeys,
}: {
    columns: Column<T>[];
    data: T[];
    defaultColWidth: number;
    containerPaddingPx: number;
    containerWidth: number;
    rowKeyField?: string;
    storageKey?: string;
    initialPinnedColumnKeys?: string[];
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
}: AirTableProps<T>) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const tableAreaRef = useRef<HTMLDivElement | null>(null);

    /* =========================
       Hooks (역할 요약)
       ========================= */

    // useContainerWidth: wrapper DOM의 현재 너비를 실시간으로 추적해서 컬럼 % 너비 계산 등에 사용
    const containerWidth = useContainerWidth(wrapperRef);

    // expandedRowKeys: RowToggle(상세 Row) 확장 여부를 Set으로 관리
    const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(() => new Set());

    // useTable: 컬럼/데이터 기반으로 테이블 렌더 구조(rows/columns) + 상태(순서/너비/가시성/핀/드래그)를 생성하고 관리
    const state = useTable<T>({
        columns,
        data,
        defaultColWidth,
        containerPaddingPx: 0,
        containerWidth,
        rowKeyField: rowKeyField ? String(rowKeyField) : undefined,
        storageKey,
        initialPinnedColumnKeys,
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

    // useGridMeta: 현재 컬럼 순서/가시성/핀/드래그 미리보기 정보를 바탕으로 grid-template-columns / x좌표 / shift offset 등을 계산
    const { baseOrder, previewOrder, gridTemplateColumns, baseXByKey, offsetByKey, tableMinWidthPx } = useGridMeta({
        columnOrder,
        visibleKeys,
        widthByKey,
        defaultColWidth,
        pinnedColumnKeys,
        dragPreviewOrder: drag.previewOrder,
    });

    // useGridPointer: wrapper/scroll DOM을 이용해서 pointer(clientX/Y)를 grid 내부 좌표로 변환하고, 드래그 시 삽입 인덱스를 계산
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

    // useLastPointerPosition: 마지막 마우스/포인터 위치를 ref로 저장해서 autoScroll 같은 로직에서 사용
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

    // useSelectionRange: selection(start/end) 기반으로 드래그 범위 좌표 계산 + 특정 셀이 선택됐는지 판별
    const { getRange, isCellSelected } = useSelectionRange(selection);

    const toggleRowExpanded = useCallback((rowKey: string) => {
        setExpandedRowKeys((prev) => {
            const next = new Set(prev);
            if (next.has(rowKey)) next.delete(rowKey);
            else next.add(rowKey);
            return next;
        });
    }, []);

    const isRowExpanded = useCallback((rowKey: string) => expandedRowKeys.has(rowKey), [expandedRowKeys]);

    // useAutoScroll: 선택 드래그/컬럼 드래그 중, pointer가 가장자리에 가까우면 자동으로 scrollRef를 스크롤
    useAutoScroll({
        scrollRef,
        lastMouseClientRef,
        enabled: selection.isSelecting || !!drag.draggingKey,
    });

    // useColumnResize: 컬럼 리사이즈 시작/이동/종료 이벤트를 관리하고 resizeColumn을 호출해서 너비를 변경
    useColumnResize({
        resizeRef,
        getXInGrid,
        resizeColumn,
    });

    // useColumnDrag: 헤더 드래그를 감지해 previewOrder 계산, ghost 표시, 최종 commitColumnOrder까지 수행
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

    // useSelectionMouseUpEnd: 드래그 중(셀 선택, 컬럼 드래그 등) 마우스 업 시 selection 상태를 종료시키는 역할
    useSelectionMouseUpEnd({
        drag,
        setSelection,
    });

    // useCopySelection: 선택 영역이 존재할 때 Ctrl/Cmd + C 이벤트를 감지해서 선택 영역 데이터를 클립보드로 복사
    useCopySelection({
        stateRows: state.rows,
        baseOrder,
        getRange,
        draggingKey: drag.draggingKey,
    });

    // usePinnedStyle: pinned 컬럼을 sticky로 고정시키기 위한 left/zIndex/border 등의 스타일을 계산
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
