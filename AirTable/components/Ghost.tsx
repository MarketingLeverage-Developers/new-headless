import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAirTableContext } from '../AirTable';
import { getThemeColor } from '@/shared/utils/css/getThemeColor';

type GhostProps = {
    className?: string;
};

export const Ghost = <T,>({ className }: GhostProps) => {
    const { ghost, lastMouseClientRef, props, state } = useAirTableContext<T>();

    const ghostRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!ghost) return;

        let rafId = 0;

        const tick = () => {
            const el = ghostRef.current;
            if (!el) {
                rafId = requestAnimationFrame(tick);
                return;
            }

            const last = lastMouseClientRef.current;
            if (!last) {
                rafId = requestAnimationFrame(tick);
                return;
            }

            const rect = el.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;

            el.style.transform = `translate3d(${last.x - w / 2}px, ${last.y - h / 2}px, 0)`;

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [ghost, lastMouseClientRef]);

    if (!ghost) return null;
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={ghostRef}
            className={className}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: ghost.width,
                height: 44,
                background: getThemeColor('White1'),
                color: getThemeColor('Black1'),
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 8,
                boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
                zIndex: 2147483647,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                fontWeight: 600,
                willChange: 'transform',
                transform: `translate3d(-9999px, -9999px, 0)`,
            }}
        >
            {state.columnRow.columns.find((c) => c.key === ghost.key)?.render(ghost.key, props.data)}
        </div>,
        document.body
    );
};
