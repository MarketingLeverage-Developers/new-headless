import React, { useCallback, useEffect } from 'react';
import { MIN_COL_WIDTH, useAirTableContext } from '../AirTable';

type HeaderProps = {
    className?: string;
    headerCellClassName?: string;
    resizeHandleClassName?: string;
};

export const Header = <T,>({ className, headerCellClassName, resizeHandleClassName }: HeaderProps) => {
    const {
        props,
        scrollRef,
        state,
        baseOrder,
        gridTemplateColumns,
        widthByKey,
        baseXByKey,
        headerScrollLeft,
        setHeaderScrollLeft,
        resizeRef,
        getXInGrid,
        getYInGrid,
        getShiftStyle,
        setGhost,
    } = useAirTableContext<T>();

    const { data, defaultColWidth = 160 } = props;
    const { columnRow, startColumnDrag, resizeColumn } = state;

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const handleScroll = () => {
            setHeaderScrollLeft(el.scrollLeft);
        };

        handleScroll();
        el.addEventListener('scroll', handleScroll);
        return () => el.removeEventListener('scroll', handleScroll);
    }, [scrollRef, setHeaderScrollLeft]);

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
    }, [getXInGrid, resizeColumn, resizeRef]);

    const handleHeaderMouseDown = (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => {
        if (resizeRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        const x = getXInGrid(e.clientX);
        const y = getYInGrid(e.clientY);

        startColumnDrag(colKey, x);

        const w = widthByKey[colKey] ?? defaultColWidth;

        setGhost({
            key: colKey,
            startX: x,
            startY: y,
            offsetX: 0,
            offsetY: 0,
            width: Math.max(MIN_COL_WIDTH, w),
            leftInGrid: baseXByKey[colKey] ?? 0,
            topInGrid: 0,
        });
    };

    return (
        <div className={className} style={{ overflow: 'hidden' }}>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns,
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    transform: `translateX(-${headerScrollLeft}px)`,
                    willChange: 'transform',
                }}
            >
                {baseOrder.map((colKey) => {
                    const col = columnRow.columns.find((c) => c.key === colKey);
                    if (!col) return null;

                    return (
                        <div
                            key={`h-${colKey}`}
                            className={headerCellClassName}
                            style={{
                                position: 'relative',
                                cursor: 'grab',
                                userSelect: 'none',
                                ...getShiftStyle(colKey),
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
                                    width: 8,
                                    height: '100%',
                                    cursor: 'col-resize',
                                    zIndex: 20,
                                }}
                                onMouseDown={handleResizeMouseDown(colKey)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
