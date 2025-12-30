import React, { useCallback } from 'react';
import { MIN_COL_WIDTH, useAirTableContext } from '../AirTable';
import { getThemeColor } from '@/shared/utils/css/getThemeColor';

type HeaderProps = {
    className?: string;
    headerCellClassName?: string;
    resizeHandleClassName?: string;
};

export const Header = <T,>({ className, headerCellClassName, resizeHandleClassName }: HeaderProps) => {
    const {
        props,
        state,
        baseOrder,
        gridTemplateColumns,
        widthByKey,
        baseXByKey,
        resizeRef,
        getXInGrid,
        getYInGrid,
        getShiftStyle,
        getPinnedStyle,
        setGhost,
        scrollRef, // ✅ 여기 반드시 필요
    } = useAirTableContext<T>();

    const { data, defaultColWidth = 160, pinnedColumnKeys = [] } = props;
    const { columnRow, startColumnDrag } = state;

    const handleResizeMouseDown = useCallback(
        (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();

            const startX = getXInGrid(e.clientX);
            const startWidth = widthByKey[colKey] ?? defaultColWidth;

            resizeRef.current = { key: colKey, startX, startWidth };
        },
        [getXInGrid, widthByKey, defaultColWidth, resizeRef]
    );

    const handleHeaderMouseDown = (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => {
        if (resizeRef.current) return;

        // ✅ pinned 컬럼은 이동 막기 (원하면 유지)
        if (pinnedColumnKeys.includes(colKey)) return;

        e.preventDefault();
        e.stopPropagation();

        const x = getXInGrid(e.clientX);
        const y = getYInGrid(e.clientY);

        startColumnDrag(colKey, x);

        const w = widthByKey[colKey] ?? defaultColWidth;

        // ✅✅✅ 핵심: sticky 헤더가 "보이는 위치"는 scrollTop 지점이므로 topInGrid에 넣어야 함
        const scrollTop = scrollRef.current?.scrollTop ?? 0;

        setGhost({
            key: colKey,
            startX: x,
            startY: y,
            offsetX: 0,
            offsetY: 0,
            width: Math.max(MIN_COL_WIDTH, w),
            leftInGrid: baseXByKey[colKey] ?? 0,
            topInGrid: scrollTop, // ✅✅✅ 핵심
        });
    };

    return (
        <div
            className={className}
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 120,
                left: 'auto',
                right: 'auto',
                overflow: 'visible',

                // ✅✅✅ 핵심: 배경이 끊기지 않게 wrapper 자체가 table 폭을 먹어야 함
                width: 'fit-content',
                minWidth: '100%',
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns,
                    minWidth: 'fit-content',
                    width: 'fit-content',
                }}
            >
                {baseOrder.map((colKey) => {
                    const col = columnRow.columns.find((c) => c.key === colKey);
                    if (!col) return null;

                    const isPinned = pinnedColumnKeys.includes(colKey);

                    return (
                        <div
                            key={`h-${colKey}`}
                            className={headerCellClassName}
                            style={{
                                position: 'relative',
                                cursor: isPinned ? 'default' : 'grab',
                                userSelect: 'none',
                                ...getShiftStyle(colKey),
                                ...getPinnedStyle(colKey, getThemeColor('Primary1'), { isHeader: true }),
                            }}
                            onMouseDown={handleHeaderMouseDown(colKey)}
                        >
                            {col.render(colKey, data)}

                            <div
                                className={resizeHandleClassName}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    width: 10,
                                    height: '100%',
                                    cursor: 'col-resize',
                                    zIndex: 60,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                onMouseDown={handleResizeMouseDown(colKey)}
                            >
                                <div
                                    style={{
                                        width: 1,
                                        height: '50%',
                                        borderRadius: 2,
                                        background: 'rgba(0,0,0,0.18)',
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
