import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CellRenderMeta } from '../AirTable';
import { useAirTableContext } from '../AirTable';
import styles from './Body.module.scss';
import { AnimatePresence, motion } from 'framer-motion';
import { getThemeColor } from '@/shared/utils/css/getThemeColor';

type HeightState = number | 'auto';

type ExpandableDetailRowProps = {
    expanded: boolean;
    gridTemplateColumns: string;
    rowClassName?: string;
    cellClassName?: string;
    children: React.ReactNode;
};

const TRANSITION_MS = 260;
const APPEAR_DELAY_MS = 40;

const ExpandableDetailRow = ({
    expanded,
    gridTemplateColumns,
    rowClassName,
    cellClassName,
    children,
}: ExpandableDetailRowProps) => {
    const contentRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const timerRef = useRef<number | null>(null);

    const [shouldRender, setShouldRender] = useState<boolean>(expanded);
    const [height, setHeight] = useState<HeightState>(expanded ? 'auto' : 0);
    const [visualOpen, setVisualOpen] = useState<boolean>(false);

    const clearTimers = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;

        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = null;
    };

    useLayoutEffect(() => {
        clearTimers();

        if (expanded) {
            setShouldRender(true);
            setHeight(0);
            setVisualOpen(false);

            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = requestAnimationFrame(() => {
                    const el = contentRef.current;
                    const nextH = el ? el.scrollHeight : 0;

                    setHeight(nextH);

                    timerRef.current = window.setTimeout(() => {
                        setVisualOpen(true);
                    }, APPEAR_DELAY_MS);

                    timerRef.current = window.setTimeout(() => {
                        setHeight('auto');
                    }, TRANSITION_MS + 80);
                });
            });

            return;
        }

        setVisualOpen(false);

        const el = contentRef.current;
        const currentH = el ? el.scrollHeight : 0;

        setHeight(currentH);

        rafRef.current = requestAnimationFrame(() => {
            setHeight(0);

            timerRef.current = window.setTimeout(() => {
                setShouldRender(false);
            }, TRANSITION_MS + 80);
        });

        return;
    }, [expanded]);

    useLayoutEffect(() => clearTimers, []);

    if (!shouldRender) return null;

    return (
        <div
            className={rowClassName}
            style={{
                display: 'grid',
                gridTemplateColumns,
                minWidth: '100%',
            }}
        >
            <div
                className={cellClassName}
                style={{
                    gridColumn: '1 / -1',
                    width: '100%',
                }}
            >
                <div
                    style={{
                        overflow: 'hidden',
                        height: height === 'auto' ? 'auto' : `${height}px`,
                        transition: `height ${TRANSITION_MS}ms ease`,
                        willChange: 'height',
                    }}
                    onTransitionEnd={(e) => {
                        if (e.propertyName !== 'height') return;

                        if (timerRef.current) window.clearTimeout(timerRef.current);
                        timerRef.current = null;

                        if (expanded) setHeight('auto');
                        else setShouldRender(false);
                    }}
                >
                    <div className={[styles.detailRoot, visualOpen ? styles.detailOpen : ''].join(' ')}>
                        <div ref={contentRef} className={styles.detailInner}>
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

type BodyProps = {
    className?: string;
    style?: React.CSSProperties;
    rowClassName?: string;
    cellClassName?: string;
    selectedCellClassName?: string;
    detailRowClassName?: string;
    detailCellClassName?: string;
};

export const Body = <T,>({
    className,
    style,
    rowClassName,
    cellClassName,
    selectedCellClassName,
    detailRowClassName,
    detailCellClassName,
}: BodyProps) => {
    const {
        props,
        tableAreaRef,
        scrollRef,
        state,
        baseOrder,
        gridTemplateColumns,
        getShiftStyle,
        getPinnedStyle,
        setSelection,
        isCellSelected,
        toggleRowExpanded,
        isRowExpanded,
    } = useAirTableContext<T>();

    const { drag, rows, pinnedColumnKeys } = state;
    const { getRowStyle, detailRenderer, getRowCanExpand, getExpandedRows, enableAnimation = false } = props;
    const animationRowLimit = props.animationRowLimit ?? 200;
    const getAnimationMode = () => {
        if (typeof window === 'undefined') return 'row';
        const value = (window as any).__AIRTABLE_ANIM_MODE__;
        return value === 'full' || value === 'row' ? value : 'row';
    };
    const enableVirtualization = props.enableVirtualization ?? false;
    const virtualRowHeight = props.virtualRowHeight ?? 44;
    const virtualOverscan = props.virtualOverscan ?? 6;
    const canVirtualize = enableVirtualization && !detailRenderer && !getExpandedRows;
    const animationMode = getAnimationMode();
    const shouldAnimate =
        enableAnimation && !canVirtualize && (animationRowLimit <= 0 || rows.length <= animationRowLimit);
    const useFullCellAnimation = shouldAnimate && animationMode === 'full';

    const bodyRef = useRef<HTMLDivElement | null>(null);
    const virtualScrollRef = useRef<HTMLElement | null>(null);
    const [virtualState, setVirtualState] = useState<{ top: number; height: number }>({
        top: 0,
        height: 0,
    });

    const resolveVirtualScrollEl = useCallback(() => {
        if (typeof window === 'undefined') return scrollRef.current;
        const internal = scrollRef.current;
        if (internal) {
            const style = window.getComputedStyle(internal);
            const overflowY = style.overflowY;
            const canScrollY =
                (overflowY === 'auto' || overflowY === 'scroll') && internal.scrollHeight > internal.clientHeight + 1;
            if (canScrollY) return internal;
        }

        const root = bodyRef.current?.parentElement;
        let parent = root?.parentElement ?? null;
        while (parent) {
            const style = window.getComputedStyle(parent);
            const overflowY = style.overflowY;
            const canScrollY =
                (overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight + 1;
            if (canScrollY) return parent;
            parent = parent.parentElement;
        }

        return internal;
    }, [scrollRef]);

    const updateVirtualState = useCallback(() => {
        const scrollEl = virtualScrollRef.current ?? resolveVirtualScrollEl();
        const bodyEl = bodyRef.current;
        if (!scrollEl || !bodyEl) return;

        if (scrollEl !== virtualScrollRef.current) {
            virtualScrollRef.current = scrollEl;
        }

        const scrollTop = scrollEl.scrollTop;
        const scrollRect = scrollEl.getBoundingClientRect();
        const bodyRect = bodyEl.getBoundingClientRect();
        const bodyTopInScroll = bodyRect.top - scrollRect.top + scrollTop;
        const bodyBottomInScroll = bodyTopInScroll + bodyEl.offsetHeight;
        const viewportTop = scrollTop;
        const viewportBottom = scrollTop + scrollEl.clientHeight;
        const visibleTop = Math.max(bodyTopInScroll, viewportTop);
        const visibleBottom = Math.min(bodyBottomInScroll, viewportBottom);
        const bodyScrollTop = Math.max(0, visibleTop - bodyTopInScroll);
        const viewportHeight = Math.max(0, visibleBottom - visibleTop);

        setVirtualState({ top: bodyScrollTop, height: viewportHeight });
    }, [resolveVirtualScrollEl]);

    useEffect(() => {
        if (!canVirtualize) return;
        updateVirtualState();
    }, [canVirtualize, rows.length, virtualRowHeight, updateVirtualState]);

    useEffect(() => {
        if (!canVirtualize) return;
        const scrollEl = resolveVirtualScrollEl();
        if (!scrollEl) return;

        let raf = 0;
        const handle = () => {
            if (raf) return;
            raf = window.requestAnimationFrame(() => {
                raf = 0;
                updateVirtualState();
            });
        };

        handle();
        scrollEl.addEventListener('scroll', handle);
        window.addEventListener('resize', handle);
        return () => {
            scrollEl.removeEventListener('scroll', handle);
            window.removeEventListener('resize', handle);
            if (raf) window.cancelAnimationFrame(raf);
        };
    }, [canVirtualize, resolveVirtualScrollEl, updateVirtualState]);

    let rowsToRender = rows;
    let rowIndexOffset = 0;
    let paddingTop = 0;
    let paddingBottom = 0;

    if (canVirtualize && rows.length > 0) {
        const startIndex = Math.max(0, Math.floor(virtualState.top / virtualRowHeight) - virtualOverscan);
        const endIndex = Math.min(
            rows.length - 1,
            Math.ceil((virtualState.top + virtualState.height) / virtualRowHeight) + virtualOverscan
        );

        rowsToRender = rows.slice(startIndex, endIndex + 1);
        rowIndexOffset = startIndex;
        paddingTop = startIndex * virtualRowHeight;
        paddingBottom = Math.max(0, (rows.length - endIndex - 1) * virtualRowHeight);
    }

    const beginSelect = (ri: number, ci: number) => {
        setSelection({ start: { ri, ci }, end: { ri, ci }, isSelecting: true });
    };

    const updateSelect = (ri: number, ci: number) => {
        setSelection((prev) => {
            if (!prev.isSelecting) return prev;
            return { ...prev, end: { ri, ci } };
        });
    };

    const INDENT_PX = 24;
    const indentTargetKey = pinnedColumnKeys[0] ?? baseOrder[0];

    return (
        <div
            className={className}
            ref={bodyRef}
            style={{
                ...style,
                userSelect: 'none',
                minHeight: 0,
                minWidth: 0,
                overflow: 'visible',
                maxHeight: 'none',
            }}
        >
            <div ref={tableAreaRef} style={{ position: 'relative', minWidth: 'fit-content', width: 'fit-content' }}>
                <div>
                    {paddingTop > 0 && <div style={{ height: paddingTop }} />}
                    {shouldAnimate ? (
                        <AnimatePresence initial={false}>
                            {rowsToRender.map((row, ri) => {
                                const actualRi = rowIndexOffset + ri;
                                const rowStyleRaw = getRowStyle?.(row.item, actualRi) ?? {};
                                const rowKey = row.key;

                                const canExpand =
                                    !!detailRenderer && (getRowCanExpand ? getRowCanExpand(row.item, actualRi) : true);

                                const expanded = canExpand && isRowExpanded(rowKey);
                                const rowBg = rowStyleRaw.backgroundColor;

                                const { backgroundColor: _bg, ...rowStyle } = rowStyleRaw;

                                const meta: CellRenderMeta<T> = {
                                    rowKey,
                                    ri: actualRi,
                                    level: row.level,
                                    toggleRowExpanded,
                                    isRowExpanded,
                                };

                                const isChild = row.level > 0;

                                const cellMap = new Map(row.cells.map((c) => [c.key, c]));

                                return (
                                    <React.Fragment key={rowKey}>
                                        <motion.div
                                            layout={useFullCellAnimation ? true : 'position'}
                                            layoutId={useFullCellAnimation ? `air-row-${rowKey}` : undefined}
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            transition={{
                                                duration: 0.26,
                                                ease: [0.22, 1, 0.36, 1],
                                            }}
                                            className={rowClassName}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns,
                                                ...rowStyle,
                                            }}
                                        >
                                            {baseOrder.map((colKey, ci) => {
                                                const cell = cellMap.get(colKey);
                                                if (!cell) return null;

                                                const selected = isCellSelected(actualRi, ci);
                                                const cellBg = selected ? undefined : rowBg ? rowBg : undefined;

                                                const isIndentTarget = colKey === indentTargetKey;
                                                const indentPadding = isChild ? row.level * INDENT_PX : 0;

                                                const cellKey = `c-${rowKey}-${colKey}`;
                                                const cellProps = {
                                                    id: `__cell_${row.key}_${colKey}`,
                                                    className: [
                                                        cellClassName ?? '',
                                                        selected ? (selectedCellClassName ?? '') : '',
                                                    ].join(' '),
                                                    onMouseDown: (e: React.MouseEvent) => {
                                                        if (drag.draggingKey) return;
                                                        if (e.button !== 0) return;
                                                        e.preventDefault();

                                                        const target = e.target as HTMLElement;
                                                        if (target.closest('[data-row-toggle="true"]')) return;

                                                        beginSelect(actualRi, ci);
                                                    },
                                                    onMouseEnter: () => {
                                                        if (drag.draggingKey) return;
                                                        updateSelect(actualRi, ci);
                                                    },
                                                    onContextMenu: (e: React.MouseEvent) => {
                                                        if (drag.draggingKey) return;

                                                        e.preventDefault();
                                                        e.stopPropagation();

                                                        const alreadySelected = isCellSelected(actualRi, ci);

                                                        if (!alreadySelected) {
                                                            setSelection({
                                                                start: { ri: actualRi, ci },
                                                                end: { ri: actualRi, ci },
                                                                isSelecting: false,
                                                            });
                                                        }

                                                        window.dispatchEvent(
                                                            new CustomEvent('AIR_TABLE_OPEN_CONTEXT_MENU', {
                                                                detail: {
                                                                    x: e.clientX,
                                                                    y: e.clientY,
                                                                    ri: actualRi,
                                                                    ci,
                                                                    rowKey: row.key,
                                                                    colKey,
                                                                },
                                                            })
                                                        );
                                                    },
                                                    style: {
                                                        backgroundColor: cellBg,
                                                        ...getShiftStyle(colKey),
                                                        ...getPinnedStyle(colKey, cellBg ?? getThemeColor('White1')),
                                                        ...(isIndentTarget ? { paddingLeft: indentPadding } : {}),
                                                    },
                                                };

                                                return useFullCellAnimation ? (
                                                    <motion.div
                                                        key={cellKey}
                                                        layout
                                                        layoutId={`air-cell-${rowKey}-${colKey}`}
                                                        transition={{
                                                            duration: 0.26,
                                                            ease: [0.22, 1, 0.36, 1],
                                                        }}
                                                        {...cellProps}
                                                    >
                                                        {cell.render(row.item, actualRi, meta)}
                                                    </motion.div>
                                                ) : (
                                                    <div key={cellKey} {...cellProps}>
                                                        {cell.render(row.item, actualRi, meta)}
                                                    </div>
                                                );
                                            })}
                                        </motion.div>

                                        {canExpand && (
                                            <ExpandableDetailRow
                                                expanded={expanded}
                                                gridTemplateColumns={gridTemplateColumns}
                                                rowClassName={detailRowClassName}
                                                cellClassName={detailCellClassName}
                                            >
                                                {detailRenderer?.({ row: row.item, ri: actualRi })}
                                            </ExpandableDetailRow>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </AnimatePresence>
                    ) : (
                        rowsToRender.map((row, ri) => {
                            const actualRi = rowIndexOffset + ri;
                            const rowStyleRaw = getRowStyle?.(row.item, actualRi) ?? {};
                            const rowKey = row.key;

                            const canExpand =
                                !!detailRenderer && (getRowCanExpand ? getRowCanExpand(row.item, actualRi) : true);

                            const expanded = canExpand && isRowExpanded(rowKey);
                            const rowBg = rowStyleRaw.backgroundColor;

                            const { backgroundColor: _bg, ...rowStyle } = rowStyleRaw;

                            const meta: CellRenderMeta<T> = {
                                rowKey,
                                ri: actualRi,
                                level: row.level,
                                toggleRowExpanded,
                                isRowExpanded,
                            };

                            const isChild = row.level > 0;

                            const cellMap = new Map(row.cells.map((c) => [c.key, c]));

                            return (
                                <React.Fragment key={rowKey}>
                                    <div
                                        className={rowClassName}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns,
                                            ...rowStyle,
                                        }}
                                    >
                                        {baseOrder.map((colKey, ci) => {
                                            const cell = cellMap.get(colKey);
                                            if (!cell) return null;

                                            const selected = isCellSelected(actualRi, ci);
                                            const cellBg = selected ? undefined : rowBg ? rowBg : undefined;

                                            const isIndentTarget = colKey === indentTargetKey;
                                            const indentPadding = isChild ? row.level * INDENT_PX : 0;

                                            return (
                                                <div
                                                    key={`c-${rowKey}-${colKey}`}
                                                    id={`__cell_${row.key}_${colKey}`}
                                                    className={[
                                                        cellClassName ?? '',
                                                        selected ? (selectedCellClassName ?? '') : '',
                                                    ].join(' ')}
                                                    onMouseDown={(e) => {
                                                        if (drag.draggingKey) return;
                                                        if (e.button !== 0) return;
                                                        e.preventDefault();

                                                        const target = e.target as HTMLElement;
                                                        if (target.closest('[data-row-toggle="true"]')) return;

                                                        beginSelect(actualRi, ci);
                                                    }}
                                                    onMouseEnter={() => {
                                                        if (drag.draggingKey) return;
                                                        updateSelect(actualRi, ci);
                                                    }}
                                                    onContextMenu={(e) => {
                                                        if (drag.draggingKey) return;

                                                        e.preventDefault();
                                                        e.stopPropagation();

                                                        const alreadySelected = isCellSelected(actualRi, ci);

                                                        if (!alreadySelected) {
                                                            setSelection({
                                                                start: { ri: actualRi, ci },
                                                                end: { ri: actualRi, ci },
                                                                isSelecting: false,
                                                            });
                                                        }

                                                        window.dispatchEvent(
                                                            new CustomEvent('AIR_TABLE_OPEN_CONTEXT_MENU', {
                                                                detail: {
                                                                    x: e.clientX,
                                                                    y: e.clientY,
                                                                    ri: actualRi,
                                                                    ci,
                                                                    rowKey: row.key,
                                                                    colKey,
                                                                },
                                                            })
                                                        );
                                                    }}
                                                    style={{
                                                        backgroundColor: cellBg,
                                                        ...getShiftStyle(colKey),
                                                        ...getPinnedStyle(colKey, cellBg ?? getThemeColor('White1')),
                                                        ...(isIndentTarget ? { paddingLeft: indentPadding } : {}),
                                                    }}
                                                >
                                                    {cell.render(row.item, actualRi, meta)}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {canExpand && (
                                        <ExpandableDetailRow
                                            expanded={expanded}
                                            gridTemplateColumns={gridTemplateColumns}
                                            rowClassName={detailRowClassName}
                                            cellClassName={detailCellClassName}
                                        >
                                            {detailRenderer?.({ row: row.item, ri: actualRi })}
                                        </ExpandableDetailRow>
                                    )}
                                </React.Fragment>
                            );
                        })
                    )}
                    {paddingBottom > 0 && <div style={{ height: paddingBottom }} />}
                </div>
            </div>
        </div>
    );
};
