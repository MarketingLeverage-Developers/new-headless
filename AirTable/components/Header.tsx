import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MIN_COL_WIDTH, useAirTableContext } from '../AirTable';
import { getThemeColor } from '@/shared/utils/css/getThemeColor';

type HeaderProps = {
    className?: string;
    headerCellClassName?: string;
    resizeHandleClassName?: string;
};

type MenuState = {
    open: boolean;
    colKey: string | null;
    x: number;
    y: number;
};

const stopOnly = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

const dividerStyle: React.CSSProperties = {
    height: 1,
    background: 'rgba(0,0,0,0.08)',
    margin: '6px 0',
};

const ColumnHeaderMenu = ({
    menu,
    onClose,
    onPinLeft,
    onUnpin,
    onHide,
    onOpenManageColumns,
    isPinned,
}: {
    menu: MenuState;
    onClose: () => void;
    onPinLeft: () => void;
    onUnpin: () => void;
    onHide: () => void;
    onOpenManageColumns: () => void;
    isPinned: boolean;
}) => {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!menu.open) return;

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
    }, [menu.open, onClose]);

    if (!menu.open) return null;
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={ref}
            style={{
                position: 'fixed',
                top: menu.y,
                left: menu.x,
                width: 200,
                background: getThemeColor('White1'),
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 10,
                boxShadow: '0 12px 24px rgba(0,0,0,0.14)',
                zIndex: 2147483647,
                padding: 6,
                userSelect: 'none',
            }}
        >
            <button
                type="button"
                style={itemStyle}
                onClick={() => {
                    if (isPinned) onUnpin();
                    else onPinLeft();
                    onClose();
                }}
            >
                {isPinned ? '고정 해제' : '컬럼 고정'}
            </button>

            <div style={dividerStyle} />

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

            {/* <button
                type="button"
                style={itemStyle}
                onClick={() => {
                    onOpenManageColumns();
                    onClose();
                }}
            >
                Manage columns
            </button> */}
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
    const { columnRow, startColumnDrag, setVisibleColumnKeys, visibleColumnKeys } = state;

    const [menu, setMenu] = useState<MenuState>({ open: false, colKey: null, x: 0, y: 0 });

    const openMenu = useCallback((colKey: string, e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();

        setMenu({
            open: true,
            colKey,
            x: rect.left - 160,
            y: rect.bottom + 8,
        });
    }, []);

    const closeMenu = useCallback(() => {
        setMenu({ open: false, colKey: null, x: 0, y: 0 });
    }, []);

    const targetColKey = menu.colKey;

    const isPinnedTarget = useMemo(() => {
        if (!targetColKey) return false;
        return pinnedColumnKeys.includes(targetColKey);
    }, [targetColKey, pinnedColumnKeys]);

    const handlePinLeft = useCallback(() => {
        if (!targetColKey) return;
        if (pinnedColumnKeys.includes(targetColKey)) return;
        setPinnedColumnKeys([...pinnedColumnKeys, targetColKey]);
    }, [targetColKey, pinnedColumnKeys, setPinnedColumnKeys]);

    const handleUnpin = useCallback(() => {
        if (!targetColKey) return;
        setPinnedColumnKeys(pinnedColumnKeys.filter((k) => k !== targetColKey));
    }, [targetColKey, pinnedColumnKeys, setPinnedColumnKeys]);

    const handleHideColumn = useCallback(() => {
        if (!targetColKey) return;

        const next = visibleColumnKeys.filter((k) => k !== targetColKey);
        setVisibleColumnKeys(next);

        if (pinnedColumnKeys.includes(targetColKey)) {
            setPinnedColumnKeys(pinnedColumnKeys.filter((k) => k !== targetColKey));
        }
    }, [targetColKey, visibleColumnKeys, setVisibleColumnKeys, pinnedColumnKeys, setPinnedColumnKeys]);

    const handleOpenManageColumns = useCallback(() => {
        window.dispatchEvent(new CustomEvent('AIR_TABLE_OPEN_COLUMN_VISIBILITY'));
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

    // ✅✅✅ hover 시에만 메뉴버튼 보이게 하기 위한 "스타일 주입"
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 26 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>{col.render(colKey, data)}</div>

                                    {/* ✅ 메뉴 버튼 (hover 시에만 보임) */}
                                    <button
                                        type="button"
                                        data-col-menu-btn="true"
                                        onMouseDownCapture={stopOnly}
                                        onClick={(e) => openMenu(colKey, e)}
                                        style={{
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
                                            flexShrink: 0,
                                        }}
                                        title="Column menu"
                                    >
                                        ⋮
                                    </button>
                                </div>

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

            <ColumnHeaderMenu
                menu={menu}
                onClose={closeMenu}
                onPinLeft={handlePinLeft}
                onUnpin={handleUnpin}
                onHide={handleHideColumn}
                onOpenManageColumns={handleOpenManageColumns}
                isPinned={isPinnedTarget}
            />
        </>
    );
};
