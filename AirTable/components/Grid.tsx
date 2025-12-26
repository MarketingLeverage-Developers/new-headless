import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAirTableContext, MIN_COL_WIDTH, type SelectionState } from '../AirTable';
import { Container } from './Container';
import { Header } from './Header';
import { Body } from './Body';
import { Ghost } from './Ghost';
import { ColumnVisibilityControl } from './ColumnVisibilityControl';
import { GridLayoutProvider, type GridLayout } from './GridLayoutContext';

export const Grid = <T,>() => {
    const { props, wrapperRef, scrollRef, tableAreaRef, state, lastMouseClientRef, ghost, setGhost } =
        useAirTableContext<T>();

    const { data, defaultColWidth = 160 } = props;

    const {
        columnRow,
        rows,
        columnOrder,
        drag,
        startColumnDrag,
        updateColumnDrag,
        setPreviewOrder,
        endColumnDrag,
        commitColumnOrder,
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
        const base = columnOrder.filter((k) => visibleKeys.includes(k));
        visibleKeys.forEach((k) => {
            if (!base.includes(k)) base.push(k);
        });
        return base;
    }, [columnOrder, visibleKeys]);

    const draggingKey = drag.draggingKey;

    const previewOrder = useMemo(() => {
        const p = drag.previewOrder?.filter((k) => baseOrder.includes(k)) ?? null;
        if (!p || p.length === 0) return null;
        return p;
    }, [drag.previewOrder, baseOrder]);

    const effectiveOrder = useMemo(() => {
        if (previewOrder && previewOrder.length > 0) return previewOrder;
        return baseOrder;
    }, [previewOrder, baseOrder]);

    const gridTemplateColumns = useMemo(
        () => effectiveOrder.map((k) => `${widthByKey[k] ?? defaultColWidth}px`).join(' '),
        [effectiveOrder, widthByKey, defaultColWidth]
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

    const effectiveXByKey = useMemo(() => {
        const map: Record<string, number> = {};
        let acc = 0;
        effectiveOrder.forEach((k) => {
            map[k] = acc;
            acc += widthByKey[k] ?? defaultColWidth;
        });
        return map;
    }, [effectiveOrder, widthByKey, defaultColWidth]);

    const offsetByKey = useMemo(() => {
        const map: Record<string, number> = {};
        baseOrder.forEach((k) => {
            map[k] = (effectiveXByKey[k] ?? 0) - (baseXByKey[k] ?? 0);
        });
        return map;
    }, [baseOrder, effectiveXByKey, baseXByKey]);

    const bodyScrollRef = scrollRef;
    const [headerScrollLeft, setHeaderScrollLeft] = useState(0);

    useEffect(() => {
        const el = bodyScrollRef.current;
        if (!el) return;

        const handleScroll = () => setHeaderScrollLeft(el.scrollLeft);

        handleScroll();
        el.addEventListener('scroll', handleScroll);
        return () => el.removeEventListener('scroll', handleScroll);
    }, [bodyScrollRef]);

    const getXInGrid = useCallback(
        (clientX: number) => {
            const scrollEl = bodyScrollRef.current;
            if (!scrollEl) return clientX;
            const rect = scrollEl.getBoundingClientRect();
            return clientX - rect.left + scrollEl.scrollLeft;
        },
        [bodyScrollRef]
    );

    const isInsideScrollAreaX = useCallback(
        (clientX: number) => {
            const el = bodyScrollRef.current;
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return clientX >= rect.left && clientX <= rect.right;
        },
        [bodyScrollRef]
    );

    const calcInsertIndex = useCallback(
        (x: number, dragging: string) => {
            const filtered = baseOrder.filter((k) => k !== dragging);

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

    const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

    const handleResizeMouseDown = useCallback(
        (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();

            const startX = getXInGrid(e.clientX);
            const startWidth = widthByKey[colKey] ?? defaultColWidth;

            resizeRef.current = { key: colKey, startX, startWidth };
        },
        [getXInGrid, widthByKey, defaultColWidth]
    );

    useEffect(() => {
        const handleMove = (ev: MouseEvent) => {
            const r = resizeRef.current;
            if (!r) return;

            const x = getXInGrid(ev.clientX);
            const diff = x - r.startX;
            resizeColumn(r.key, Math.max(MIN_COL_WIDTH, r.startWidth + diff));
        };

        const handleUp = () => {
            resizeRef.current = null;
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [getXInGrid, resizeColumn]);

    const handleHeaderMouseDown = (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => {
        if (resizeRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        const x = getXInGrid(e.clientX);

        startColumnDrag(colKey, x);

        const w = widthByKey[colKey] ?? defaultColWidth;

        setGhost({
            key: colKey,
            startX: x,
            startY: e.clientY,
            offsetX: 0,
            offsetY: 0,
            width: Math.max(MIN_COL_WIDTH, w),
            leftInGrid: baseXByKey[colKey] ?? 0,
            topInGrid: 0,
        });
    };

    const disableShiftAnimationRef = useRef(false);

    const [selection, setSelection] = useState<SelectionState>({
        start: null,
        end: null,
        isSelecting: false,
    });

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

    const beginSelect = useCallback((pos: { ri: number; ci: number }) => {
        setSelection({ start: pos, end: pos, isSelecting: true });
    }, []);

    const updateSelect = useCallback((pos: { ri: number; ci: number }) => {
        setSelection((prev) => (prev.isSelecting ? { ...prev, end: pos } : prev));
    }, []);

    const endSelect = useCallback(() => {
        setSelection((prev) => ({ ...prev, isSelecting: false }));
    }, []);

    useEffect(() => {
        const handleMove = (ev: MouseEvent) => {
            lastMouseClientRef.current = { x: ev.clientX, y: ev.clientY };
        };
        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, [lastMouseClientRef]);

    useEffect(() => {
        if (!draggingKey) return;

        const handleMove = (ev: MouseEvent) => {
            if (resizeRef.current) return;

            const x = getXInGrid(ev.clientX);

            updateColumnDrag(x);

            setGhost((prev) => {
                if (!prev) return prev;
                return { ...prev, offsetX: x - prev.startX };
            });

            if (!isInsideScrollAreaX(ev.clientX)) return;

            const insertIndex = calcInsertIndex(x, draggingKey);
            const filtered = baseOrder.filter((k) => k !== draggingKey);
            const next = [...filtered];
            next.splice(insertIndex, 0, draggingKey);

            setPreviewOrder(next);
        };

        const handleUp = () => {
            const dragging = drag.draggingKey;
            const final = drag.previewOrder;

            if (!dragging || !final || final.length === 0) {
                setPreviewOrder(null);
                endColumnDrag();
                setGhost(null);
                return;
            }

            disableShiftAnimationRef.current = true;
            commitColumnOrder(final);

            requestAnimationFrame(() => {
                setPreviewOrder(null);
                endColumnDrag();
                setGhost(null);
                disableShiftAnimationRef.current = false;
            });
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [
        draggingKey,
        drag.draggingKey,
        drag.previewOrder,
        baseOrder,
        calcInsertIndex,
        getXInGrid,
        commitColumnOrder,
        setPreviewOrder,
        updateColumnDrag,
        endColumnDrag,
        isInsideScrollAreaX,
        setGhost,
    ]);

    const getShiftStyle = (colKey: string): React.CSSProperties => {
        const dx = offsetByKey[colKey] ?? 0;
        const transition = disableShiftAnimationRef.current
            ? 'none'
            : draggingKey
            ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'
            : 'transform 240ms ease';

        return { transform: `translateX(${dx}px)`, transition, willChange: 'transform' };
    };

    const layout: GridLayout<T> = {
        data,
        gridTemplateColumns,
        effectiveOrder,
        headerScrollLeft,
        draggingKey,
        ghost,
        setGhost,
        selection,
        isCellSelected,
        beginSelect,
        updateSelect,
        endSelect,
        getShiftStyle,
        handleHeaderMouseDown,
        handleResizeMouseDown,
    };

    return (
        <>
            <ColumnVisibilityControl />
            <GridLayoutProvider value={layout}>
                <Container>
                    <Header />
                    <Body rows={rows} />
                    <Ghost />
                </Container>
            </GridLayoutProvider>
        </>
    );
};
