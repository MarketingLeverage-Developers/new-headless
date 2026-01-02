import { useCallback, useMemo, useRef, useState } from 'react';
import type { CellRenderMeta, Column, ColumnType } from '../AirTable';
import { MIN_COL_WIDTH } from '../AirTable';

type PersistedTableState = {
    columnWidths: Record<string, number>;
    columnOrder: string[];
    visibleColumnKeys: string[];
    knownColumnKeys: string[];
    pinnedColumnKeys?: string[];
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

export const useTableColumnsState = <T>({
    columns,
    data,
    defaultColWidth,
    containerWidth,
    rowKeyField,
    storageKey,
    initialPinnedColumnKeys,
    onPinnedColumnKeysChange,
}: {
    columns: Column<T>[];
    data: T[];
    defaultColWidth: number;
    containerWidth: number;
    rowKeyField?: string;
    storageKey?: string;
    initialPinnedColumnKeys?: string[];
    onPinnedColumnKeysChange?: (keys: string[]) => void;
}) => {
    const leafColumns = useMemo<ColumnType<T>[]>(
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

    const baseLeafWidthByKey = useMemo(() => {
        const map = new Map<string, number>();
        leafColumns.forEach((c) => {
            if (map.has(c.key)) return;
            map.set(c.key, toNumberPx(c.width, defaultColWidth, containerWidth));
        });
        return map;
    }, [leafColumns, defaultColWidth, containerWidth]);

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

    const [pinnedColumnKeys, setPinnedColumnKeysState] = useState<string[]>(() => {
        const fromPersisted = persisted?.pinnedColumnKeys ?? [];
        if (fromPersisted.length > 0) return uniq(fromPersisted);
        return uniq(initialPinnedColumnKeys ?? []);
    });

    const stateRef = useRef<PersistedTableState>({
        columnWidths,
        columnOrder,
        visibleColumnKeys: visibleColumnKeysDesired,
        knownColumnKeys: leafKeys,
        pinnedColumnKeys,
    });

    const persistNow = useCallback(() => {
        if (!storageKey) return;
        const s = stateRef.current;
        savePersistedTableState(storageKey, {
            columnWidths: s.columnWidths,
            columnOrder: uniq(s.columnOrder),
            visibleColumnKeys: uniq(s.visibleColumnKeys),
            knownColumnKeys: leafKeys,
            pinnedColumnKeys: uniq(s.pinnedColumnKeys ?? []),
        });
    }, [storageKey, leafKeys]);

    const visibleColumnKeys = useMemo(
        () => uniq(visibleColumnKeysDesired.filter((k) => leafKeySet.has(k))),
        [visibleColumnKeysDesired, leafKeySet]
    );

    const setVisibleColumnKeys = useCallback(
        (keys: string[]) => {
            const next = uniq(keys.map(String)).filter((k) => leafKeySet.has(k));
            setVisibleColumnKeysDesired(next);

            stateRef.current = { ...stateRef.current, visibleColumnKeys: next };
            persistNow();
        },
        [leafKeySet, persistNow]
    );

    const setPinnedColumnKeys = useCallback(
        (keys: string[]) => {
            const next = uniq(keys.map(String)).filter((k) => leafKeySet.has(k));
            setPinnedColumnKeysState(next);

            stateRef.current = { ...stateRef.current, pinnedColumnKeys: next };
            persistNow();

            onPinnedColumnKeysChange?.(next);
        },
        [leafKeySet, persistNow, onPinnedColumnKeysChange]
    );

    const resizeColumn = useCallback(
        (colKey: string, width: number) => {
            const key = String(colKey);
            setColumnWidths((prev) => {
                const next = { ...prev, [key]: Math.max(MIN_COL_WIDTH, width) };
                stateRef.current = { ...stateRef.current, columnWidths: next };
                persistNow();
                return next;
            });
        },
        [persistNow]
    );

    const commitColumnOrder = useCallback(
        (order: string[]) => {
            const next = uniq(order.map(String)).filter((k) => leafKeySet.has(k));
            if (next.length === 0) return;

            setColumnOrder(next);
            stateRef.current = { ...stateRef.current, columnOrder: next };
            persistNow();
        },
        [leafKeySet, persistNow]
    );

    const effectiveOrder = useMemo(() => mergeOrderByLeafKeys(columnOrder, leafKeys), [columnOrder, leafKeys]);

    const orderedLeafColumns = useMemo(() => {
        const colMap = new Map<string, ColumnType<T>>();
        leafColumns.forEach((c) => colMap.set(c.key, c));

        const res: ColumnType<T>[] = [];
        effectiveOrder.forEach((k) => {
            const c = colMap.get(k);
            if (c) res.push(c);
        });

        return res;
    }, [leafColumns, effectiveOrder]);

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

    return {
        leafColumns,
        leafKeys,
        leafKeySet,
        columnRow,
        orderedLeafColumns,
        columnOrder: uniq(columnOrder),
        visibleColumnKeys,
        setVisibleColumnKeys,
        resizeColumn,
        commitColumnOrder,
        pinnedColumnKeys,
        setPinnedColumnKeys,
    };
};
