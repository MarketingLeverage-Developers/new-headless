import React, { useLayoutEffect, useRef, useState } from 'react';
import type { CellRenderMeta } from '../AirTable';
import { useAirTableContext } from '../AirTable';
import styles from './Body.module.scss';

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

    const { drag, rows } = state;
    const { getRowStyle, detailRenderer, getRowCanExpand } = props;

    const beginSelect = (ri: number, ci: number) => {
        setSelection({ start: { ri, ci }, end: { ri, ci }, isSelecting: true });
    };

    const updateSelect = (ri: number, ci: number) => {
        setSelection((prev) => {
            if (!prev.isSelecting) return prev;
            return { ...prev, end: { ri, ci } };
        });
    };

    return (
        <div
            className={className}
            style={{
                ...style,
                userSelect: 'none',
                minHeight: 0,
                minWidth: 0,

                // ✅✅✅ 핵심: Body가 scroll 컨테이너가 되지 못하게 강제 차단
                overflow: 'visible',
                maxHeight: 'none',
            }}
        >
            <div ref={tableAreaRef} style={{ position: 'relative', minWidth: 'fit-content', width: 'fit-content' }}>
                <div>
                    {rows.map((row, ri) => {
                        const rowStyle = getRowStyle?.(row.item, ri) ?? {};
                        const rowKey = row.key;

                        const canExpand = !!detailRenderer && (getRowCanExpand ? getRowCanExpand(row.item, ri) : true);
                        const expanded = canExpand && isRowExpanded(rowKey);

                        const rowBg = rowStyle.backgroundColor;

                        const meta: CellRenderMeta<T> = {
                            rowKey,
                            ri,
                            toggleRowExpanded,
                            isRowExpanded,
                        };

                        return (
                            <React.Fragment key={rowKey}>
                                <div
                                    className={rowClassName}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns,
                                        ...Object.fromEntries(
                                            Object.entries(rowStyle).filter(([k]) => k !== 'backgroundColor')
                                        ),
                                    }}
                                >
                                    {baseOrder.map((colKey, ci) => {
                                        const cell = row.cells.find((c) => c.key === colKey);
                                        if (!cell) return null;

                                        const selected = isCellSelected(ri, ci);
                                        const cellBg = selected ? undefined : rowBg ? rowBg : undefined;

                                        return (
                                            <div
                                                key={`c-${rowKey}-${colKey}`}
                                                id={`__cell_${row.key}_${colKey}`}
                                                className={[
                                                    cellClassName ?? '',
                                                    selected ? selectedCellClassName ?? '' : '',
                                                ].join(' ')}
                                                onMouseDown={(e) => {
                                                    if (drag.draggingKey) return;
                                                    if (e.button !== 0) return; // ✅ 좌클릭만 selection 변경
                                                    e.preventDefault();

                                                    const target = e.target as HTMLElement;
                                                    if (target.closest('[data-row-toggle="true"]')) return;

                                                    beginSelect(ri, ci);
                                                }}
                                                onMouseEnter={() => {
                                                    if (drag.draggingKey) return;
                                                    updateSelect(ri, ci);
                                                }}
                                                onContextMenu={(e) => {
                                                    if (drag.draggingKey) return;

                                                    e.preventDefault();
                                                    e.stopPropagation();

                                                    // ✅ 우클릭한 셀이 "기존 선택 영역" 밖이면 그 셀만 선택으로 바꾼다
                                                    const alreadySelected = isCellSelected(ri, ci);

                                                    if (!alreadySelected) {
                                                        setSelection({
                                                            start: { ri, ci },
                                                            end: { ri, ci },
                                                            isSelecting: false,
                                                        });
                                                    }

                                                    // ✅ 컨텍스트 메뉴 열기 (Portal 컴포넌트에서 받아서 띄움)
                                                    window.dispatchEvent(
                                                        new CustomEvent('AIR_TABLE_OPEN_CONTEXT_MENU', {
                                                            detail: {
                                                                x: e.clientX,
                                                                y: e.clientY,
                                                                ri,
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
                                                    ...getPinnedStyle(colKey, cellBg ?? '#fff'),
                                                }}
                                            >
                                                {cell.render(row.item, ri, meta)}
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
                                        {detailRenderer?.({ row: row.item, ri })}
                                    </ExpandableDetailRow>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
