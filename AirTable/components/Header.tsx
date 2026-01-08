import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MIN_COL_WIDTH, useAirTableContext } from '../AirTable';
import { getThemeColor } from '@/shared/utils/css/getThemeColor';
import { motion } from 'framer-motion';

type HeaderProps = {
    className?: string;
    headerCellClassName?: string;
    resizeHandleClassName?: string;
};

const stopOnly = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
};

const ColumnFilterPopup = ({
    isOpen,
    x,
    y,
    onClose,
    children,
}: {
    isOpen: boolean;
    x: number;
    y: number;
    onClose: () => void;
    children: React.ReactNode;
}) => {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleDown = (ev: MouseEvent) => {
            const el = ref.current;
            if (!el) return;
            if (el.contains(ev.target as Node)) return;
            onClose();
        };

        const handleEsc = (ev: KeyboardEvent) => {
            if (ev.key === 'Escape') onClose();
        };

        window.addEventListener('mousedown', handleDown);
        window.addEventListener('keydown', handleEsc);

        return () => {
            window.removeEventListener('mousedown', handleDown);
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={ref}
            style={{
                position: 'fixed',
                top: y,
                left: x,
                minWidth: 240,
                background: getThemeColor('White1'),
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 10,
                boxShadow: '0 12px 24px rgba(0,0,0,0.14)',
                zIndex: 2147483647,
                padding: 10,
                cursor: 'default',
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body
    );
};

const itemStyle: React.CSSProperties = {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '10px 10px',
    textAlign: 'left',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
};

const HeaderContextMenu = ({
    isOpen,
    x,
    y,
    onClose,
    isPinned,
    onPin,
    onUnpin,
    onHide,
}: {
    isOpen: boolean;
    x: number;
    y: number;
    onClose: () => void;
    isPinned: boolean;
    onPin: () => void;
    onUnpin: () => void;
    onHide: () => void;
}) => {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleDown = (ev: MouseEvent) => {
            const el = ref.current;
            if (!el) return;
            if (el.contains(ev.target as Node)) return;
            onClose();
        };

        const handleEsc = (ev: KeyboardEvent) => {
            if (ev.key === 'Escape') onClose();
        };

        window.addEventListener('mousedown', handleDown);
        window.addEventListener('keydown', handleEsc);

        return () => {
            window.removeEventListener('mousedown', handleDown);
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={ref}
            style={{
                position: 'fixed',
                top: y,
                left: x,
                minWidth: 160,
                background: getThemeColor('White1'),
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 10,
                boxShadow: '0 12px 24px rgba(0,0,0,0.14)',
                zIndex: 2147483647,
                padding: 6,
                cursor: 'default',
                userSelect: 'none',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
        >
            <button
                type="button"
                style={itemStyle}
                onClick={() => {
                    if (isPinned) onUnpin();
                    else onPin();
                    onClose();
                }}
            >
                {isPinned ? '고정 해제' : '컬럼 고정'}
            </button>
            <button
                type="button"
                style={itemStyle}
                onClick={() => {
                    onHide();
                    onClose();
                }}
            >
                컬럼 숨기기
            </button>
        </div>,
        document.body
    );
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
        scrollRef,
        pinnedColumnKeys,
        setPinnedColumnKeys,
    } = useAirTableContext<T>();

    const { data, defaultColWidth = 160 } = props;
    const { columnRow, startColumnDrag, visibleColumnKeys, setVisibleColumnKeys } = state;

    const isDragging = !!state.drag.draggingKey;

    const [filterPopup, setFilterPopup] = useState<{
        open: boolean;
        colKey: string | null;
        x: number;
        y: number;
    }>({ open: false, colKey: null, x: 0, y: 0 });

    const [contextMenu, setContextMenu] = useState<{
        open: boolean;
        colKey: string | null;
        x: number;
        y: number;
    }>({ open: false, colKey: null, x: 0, y: 0 });

    const headerLabelRefMap = useRef<Record<string, HTMLDivElement | null>>({});
    const [minWidthByKey, setMinWidthByKey] = useState<Record<string, number>>({});

    useEffect(() => {
        const next: Record<string, number> = {};

        baseOrder.forEach((key) => {
            const el = headerLabelRefMap.current[key];
            if (!el) return;

            const labelWidth = el.scrollWidth;
            const extraPadding = 44;
            const nextMin = Math.ceil(labelWidth + extraPadding);

            next[key] = Math.max(MIN_COL_WIDTH, nextMin);
        });

        setMinWidthByKey(next);
    }, [baseOrder]);

    const openFilter = useCallback((colKey: string, e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();

        setFilterPopup({
            open: true,
            colKey,
            x: rect.left - 200,
            y: rect.bottom + 8,
        });
    }, []);

    const closeFilter = useCallback(() => {
        setFilterPopup((prev) => ({ ...prev, open: false }));
    }, []);

    const handleContextMenu = useCallback(
        (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();

            setContextMenu({
                open: true,
                colKey,
                x: e.clientX,
                y: e.clientY,
            });
        },
        []
    );

    const closeContextMenu = useCallback(() => {
        setContextMenu((prev) => ({ ...prev, open: false }));
    }, []);

    const handlePin = useCallback(() => {
        const colKey = contextMenu.colKey;
        if (!colKey) return;
        if (pinnedColumnKeys.includes(colKey)) return;
        setPinnedColumnKeys([...pinnedColumnKeys, colKey]);
    }, [contextMenu.colKey, pinnedColumnKeys, setPinnedColumnKeys]);

    const handleUnpin = useCallback(() => {
        const colKey = contextMenu.colKey;
        if (!colKey) return;
        setPinnedColumnKeys(pinnedColumnKeys.filter((k) => k !== colKey));
    }, [contextMenu.colKey, pinnedColumnKeys, setPinnedColumnKeys]);

    const handleHide = useCallback(() => {
        const colKey = contextMenu.colKey;
        if (!colKey) return;

        const next = visibleColumnKeys.filter((k) => k !== colKey);
        setVisibleColumnKeys(next);

        if (pinnedColumnKeys.includes(colKey)) {
            setPinnedColumnKeys(pinnedColumnKeys.filter((k) => k !== colKey));
        }
    }, [contextMenu.colKey, visibleColumnKeys, setVisibleColumnKeys, pinnedColumnKeys, setPinnedColumnKeys]);

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

    const handleResizeDoubleClick = useCallback(
        (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();

            const minW = minWidthByKey[colKey] ?? MIN_COL_WIDTH;
            state.resizeColumn(colKey, minW);
        },
        [minWidthByKey, state]
    );

    const handleHeaderMouseDown = (colKey: string) => (e: React.MouseEvent<HTMLDivElement>) => {
        if (resizeRef.current) return;
        if (pinnedColumnKeys.includes(colKey)) return;
        if (e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        const x = getXInGrid(e.clientX);
        const y = getYInGrid(e.clientY);

        startColumnDrag(colKey, x);

        const w = widthByKey[colKey] ?? defaultColWidth;
        const scrollTop = scrollRef.current?.scrollTop ?? 0;

        setGhost({
            key: colKey,
            startX: x,
            startY: y,
            offsetX: 0,
            offsetY: 0,
            width: Math.max(MIN_COL_WIDTH, w),
            leftInGrid: baseXByKey[colKey] ?? 0,
            topInGrid: scrollTop,
        });
    };

    const activeFilterContent = useMemo(() => {
        if (!filterPopup.open || !filterPopup.colKey) return null;
        const col = columnRow.columns.find((c) => c.key === filterPopup.colKey);
        return col?.filter ?? null;
    }, [filterPopup.open, filterPopup.colKey, columnRow.columns]);

    const isContextPinned = useMemo(() => {
        if (!contextMenu.colKey) return false;
        return pinnedColumnKeys.includes(contextMenu.colKey);
    }, [contextMenu.colKey, pinnedColumnKeys]);

    return (
        <>
            <div
                className={className}
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 120,
                    overflow: 'visible',
                    width: 'fit-content',
                    minWidth: '100%',
                }}
            >
                <motion.div
                    layout={!isDragging}
                    transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
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
                            <motion.div
                                key={`h-${colKey}`}
                                layout={!isDragging ? 'position' : false}
                                layoutId={`air-col-header-${colKey}`}
                                className={[headerCellClassName, 'air-table-header-cell'].filter(Boolean).join(' ')}
                                style={{
                                    position: 'relative',
                                    cursor: isPinned ? 'default' : 'grab',
                                    userSelect: 'none',
                                    ...(isDragging ? getShiftStyle(colKey) : {}),
                                    ...getPinnedStyle(colKey, getThemeColor('Primary1'), { isHeader: true }),
                                }}
                                onMouseDown={handleHeaderMouseDown(colKey)}
                                onContextMenu={handleContextMenu(colKey)} // ✅✅✅ 우클릭 메뉴 살려줌
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 44 }}>
                                    <div
                                        ref={(el) => {
                                            headerLabelRefMap.current[colKey] = el;
                                        }}
                                        style={{ flex: 1, minWidth: 0 }}
                                    >
                                        {col.render(colKey, data)}
                                    </div>
                                </div>

                                {col.filter && (
                                    <button
                                        type="button"
                                        data-col-menu-btn="true"
                                        onMouseDownCapture={stopOnly}
                                        onClick={(e) => openFilter(colKey, e)}
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            right: 14,
                                            width: 22,
                                            height: 22,
                                            borderRadius: 6,
                                            border: 'none',
                                            background: getThemeColor('White1'),
                                            color: getThemeColor('Black1'),
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 40,
                                        }}
                                        title="Filter"
                                    >
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                                        </svg>
                                    </button>
                                )}

                                <div
                                    className={resizeHandleClassName}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        right: 0,
                                        width: 10,
                                        height: '100%',
                                        cursor: 'ew-resize',
                                        zIndex: 60,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    onMouseDown={handleResizeMouseDown(colKey)}
                                    onDoubleClick={handleResizeDoubleClick(colKey)}
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
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>

            <ColumnFilterPopup isOpen={filterPopup.open} x={filterPopup.x} y={filterPopup.y} onClose={closeFilter}>
                {activeFilterContent}
            </ColumnFilterPopup>

            <HeaderContextMenu
                isOpen={contextMenu.open}
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={closeContextMenu}
                isPinned={isContextPinned}
                onPin={handlePin}
                onUnpin={handleUnpin}
                onHide={handleHide}
            />
        </>
    );
};
