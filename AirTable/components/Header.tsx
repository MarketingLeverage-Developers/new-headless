import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MIN_COL_WIDTH, useAirTableContext } from '../AirTable';
import { getThemeColor } from '@/shared/utils/css/getThemeColor';

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
    } = useAirTableContext<T>();

    const { data, defaultColWidth = 160 } = props;
    const { columnRow, startColumnDrag } = state;

    const [filterPopup, setFilterPopup] = useState<{
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
            x: rect.left - 200, // Show to left of button to avoid overflow? or right aligned?
            // Just some offset. Previous was rect.left - 160.
            // Let's align right edge to button right edge if possible, or just arbitrary
            y: rect.bottom + 8,
        });
    }, []);

    const closeFilter = useCallback(() => {
        setFilterPopup((prev) => ({ ...prev, open: false }));
    }, []);

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

    // ✅✅✅ 더블클릭하면 "최소 너비"로 자동 맞춤
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

    useEffect(() => {
        const handleMove = (ev: MouseEvent) => {
            const r = resizeRef.current;
            if (!r) return;

            const x = getXInGrid(ev.clientX);
            const diff = x - r.startX;

            const raw = r.startWidth + diff;

            const minW = minWidthByKey[r.key] ?? MIN_COL_WIDTH;
            const next = Math.max(minW, raw);

            state.resizeColumn(r.key, next);
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
    }, [getXInGrid, minWidthByKey, state.resizeColumn, resizeRef]);

    useEffect(() => {
        const styleId = '__air_table_header_menu_btn_style__';
        if (document.getElementById(styleId)) return;

        const styleTag = document.createElement('style');
        styleTag.id = styleId;
        styleTag.textContent = `
            .air-table-header-cell [data-col-menu-btn="true"] {
                opacity: 0;
                pointer-events: none;
                transition: opacity 120ms ease;
            }

            .air-table-header-cell:hover [data-col-menu-btn="true"],
            .air-table-header-cell:focus-within [data-col-menu-btn="true"] {
                opacity: 1;
                pointer-events: auto;
            }
        `;
        document.head.appendChild(styleTag);

        return () => {
            styleTag.remove();
        };
    }, []);

    // Resolve filter content if open
    const activeFilterContent = useMemo(() => {
        if (!filterPopup.open || !filterPopup.colKey) return null;
        const col = columnRow.columns.find((c) => c.key === filterPopup.colKey);
        return col?.filter ?? null;
    }, [filterPopup.open, filterPopup.colKey, columnRow.columns]);

    return (
        <>
            <div
                className={className}
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 120,
                    left: 'auto',
                    right: 'auto',
                    overflow: 'visible',
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
                                className={[headerCellClassName, 'air-table-header-cell'].filter(Boolean).join(' ')}
                                style={{
                                    position: 'relative',
                                    cursor: isPinned ? 'default' : 'grab',
                                    userSelect: 'none',
                                    ...getShiftStyle(colKey),
                                    ...getPinnedStyle(colKey, getThemeColor('Primary1'), { isHeader: true }),
                                }}
                                onMouseDown={handleHeaderMouseDown(colKey)}
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
                                    onDoubleClick={handleResizeDoubleClick(colKey)} // ✅✅✅ 추가
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

            <ColumnFilterPopup isOpen={filterPopup.open} x={filterPopup.x} y={filterPopup.y} onClose={closeFilter}>
                {activeFilterContent}
            </ColumnFilterPopup>
        </>
    );
};
