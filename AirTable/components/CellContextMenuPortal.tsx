import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getThemeColor } from '@/shared/utils/css/getThemeColor';
import { useAirTableContext } from '../AirTable';

type ContextMenuDetail = {
    x: number;
    y: number;
    ri: number;
    ci: number;
    rowKey: string;
    colKey: string;
};

type MenuState = ContextMenuDetail & {
    open: boolean;
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

export const CellContextMenuPortal = <T,>() => {
    const { state, setPinnedColumnKeys, pinnedColumnKeys } = useAirTableContext<T>();

    const [menu, setMenu] = useState<MenuState | null>(null);
    const ref = useRef<HTMLDivElement | null>(null);

    const close = useCallback(() => setMenu(null), []);

    useEffect(() => {
        console.log('✅ CellContextMenuPortal mounted');

        const handler = (ev: Event) => {
            const e = ev as CustomEvent<ContextMenuDetail>;

            console.log('✅ 컨텍스트 메뉴 이벤트 수신', e.detail);

            if (!e.detail) return;

            setMenu({
                open: true,
                x: e.detail.x,
                y: e.detail.y,
                ri: e.detail.ri,
                ci: e.detail.ci,
                rowKey: e.detail.rowKey,
                colKey: e.detail.colKey,
            });
        };

        window.addEventListener('AIR_TABLE_OPEN_CONTEXT_MENU', handler);
        return () => window.removeEventListener('AIR_TABLE_OPEN_CONTEXT_MENU', handler);
    }, []);

    useEffect(() => {
        if (!menu?.open) return;

        const handleDown = (ev: MouseEvent) => {
            const el = ref.current;
            if (!el) return;
            if (el.contains(ev.target as Node)) return;
            close();
        };

        const handleEsc = (ev: KeyboardEvent) => {
            if (ev.key === 'Escape') close();
        };

        window.addEventListener('mousedown', handleDown);
        window.addEventListener('keydown', handleEsc);

        return () => {
            window.removeEventListener('mousedown', handleDown);
            window.removeEventListener('keydown', handleEsc);
        };
    }, [menu?.open, close]);

    if (!menu?.open) return null;
    if (typeof document === 'undefined') return null;

    const colKey = menu.colKey;
    const isPinned = pinnedColumnKeys.includes(colKey);

    // ✅ 화면 밖으로 안 나가게 clamp
    const MENU_W = 220;
    const MENU_H = 160;

    const x = Math.min(menu.x, window.innerWidth - MENU_W - 8);
    const y = Math.min(menu.y, window.innerHeight - MENU_H - 8);

    return createPortal(
        <>
            <div
                ref={ref}
                style={{
                    position: 'fixed',
                    top: y,
                    left: x,
                    width: MENU_W,
                    background: getThemeColor('White1'),
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 10,
                    boxShadow: '0 12px 24px rgba(0,0,0,0.14)',
                    zIndex: 2147483647,
                    padding: 6,
                    userSelect: 'none',
                }}
            >
                {/* ✅ 복사 */}
                <button
                    type="button"
                    style={itemStyle}
                    onClick={() => {
                        document.execCommand('copy');
                        close();
                    }}
                >
                    복사
                </button>

                {/* <div style={dividerStyle} /> */}
            </div>
        </>,

        document.body
    );
};
